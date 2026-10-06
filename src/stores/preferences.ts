import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import {
    type BibelDisplaySettings,
    type BibelFeatures,
    type BibelTranslationId,
    type PreferencesData,
    type ServiceTabMode,
    type SongPagingMode,
    type XmlDisplaySettings,
    db,
} from '@/db';

const DEFAULT_XML_SETTINGS: XmlDisplaySettings = {
    showMeasureNumbers: false,
    showLyrics: true,
    // The playback marks are on by default: they are what the transport is for.
    // A record stored before they existed picks them up here, because
    // loadPreferences spreads these defaults under whatever it read.
    highlightNotes: true,
    showPlayhead: true,
};

// The Bible as Menge set it: headings, numbers, notes behind a marker, and
// prose verses running on as paragraphs.
export const DEFAULT_BIBEL_DISPLAY: BibelDisplaySettings = {
    showHeadings: true,
    showVerseNumbers: true,
    notesInline: false,
    versePerLine: false,
};

// On, except the reading progress: the switches are for taking away what a
// reader has no use for, not for finding features one by one. Ticking off
// chapters and following a plan is a practice someone takes up, though — off
// until asked for, it does not crowd the Bibel tab of everyone else.
export const DEFAULT_BIBEL_FEATURES: BibelFeatures = {
    fortschritt: false,
    lesezeichen: true,
    notizen: true,
    versDerWoche: true,
    lieder: true,
    vorlesen: true,
};

const MIN_PAGE_SCALE = 0.5;
const MAX_PAGE_SCALE = 2.0;

function clampScale(scale: number): number {
    return Math.max(MIN_PAGE_SCALE, Math.min(MAX_PAGE_SCALE, scale));
}

/**
 * The Bible's display settings from a stored record: the defaults under
 * whatever was stored, and only the switches that are switches — a record
 * from a later version must not smuggle anything else into the page.
 */
export function readBibelDisplay(stored: PreferencesData['bibelDisplay']): BibelDisplaySettings {
    const settings = { ...DEFAULT_BIBEL_DISPLAY };
    for (const key of Object.keys(settings) as (keyof BibelDisplaySettings)[]) {
        const value = stored?.[key];
        if (typeof value === 'boolean') settings[key] = value;
    }
    return settings;
}

/** The Bible's own size from a stored record, or null while it has none. */
export function readBibelScale(stored: PreferencesData['bibelScale']): number | null {
    return typeof stored === 'number' && Number.isFinite(stored) ? clampScale(stored) : null;
}

/** The translation from a stored record: one the app has, else Menge. */
export function readBibelTranslation(
    stored: PreferencesData['bibelTranslation'],
): BibelTranslationId {
    return stored === 'luther1912' ? stored : 'menge';
}

/**
 * The feature switches the reader has set, from a stored record — only those,
 * and only switches that are switches. What the reader never touched is not
 * stored, so it follows the defaults, including a default changed later.
 */
export function readChosenBibelFeatures(
    stored: PreferencesData['bibelFeatures'],
): Partial<BibelFeatures> {
    const chosen: Partial<BibelFeatures> = {};
    for (const key of Object.keys(DEFAULT_BIBEL_FEATURES) as (keyof BibelFeatures)[]) {
        const value = stored?.[key];
        if (typeof value === 'boolean') chosen[key] = value;
    }
    return chosen;
}

/** The feature switches in effect: what was set, over the defaults. */
export function readBibelFeatures(stored: PreferencesData['bibelFeatures']): BibelFeatures {
    return { ...DEFAULT_BIBEL_FEATURES, ...readChosenBibelFeatures(stored) };
}

/** What the retired Textgröße steps were worth, as factors of the default. */
const LEGACY_TEXT_SIZE_SCALE = {
    small: 0.889,
    medium: 1,
    large: 1.167,
    xlarge: 1.333,
} as const;

// Notengröße and Textgröße were two controls over one thing: the verses are set
// at the size of the lyrics under the notes, so sizing them apart only ever
// pulled the page out of proportion. Whichever of the two a reader had actually
// moved is what they meant by "bigger", so that is what carries over.
function migrateLegacyScale(prefs: {
    notationScale?: number;
    textSize?: keyof typeof LEGACY_TEXT_SIZE_SCALE;
}): number {
    if (typeof prefs.notationScale === 'number' && prefs.notationScale !== 1) {
        return prefs.notationScale;
    }
    if (prefs.textSize && prefs.textSize in LEGACY_TEXT_SIZE_SCALE) {
        return LEGACY_TEXT_SIZE_SCALE[prefs.textSize];
    }
    return 1;
}

export const usePreferencesStore = defineStore('preferences', () => {
    // State
    const pageScale = ref<number>(1.0); // One size for notation and verses alike
    // Null until the reader has been asked — which only happens by enlarging a
    // song past the width the page can show. See DEFAULT_BEYOND_FIT.
    const xmlSettings = ref<XmlDisplaySettings>({ ...DEFAULT_XML_SETTINGS });
    // 'auto' keeps the tab bar as it was for everyone who never holds a service;
    // whoever leads the music pins it once and always has it.
    const serviceTab = ref<ServiceTabMode>('auto');
    // Playlists and the Gottesdienst by default: those orders were put
    // together to be sung through, so the next song is a real question there.
    // From the Liederliste it is a habit some readers want and others find a
    // bar in the way of the verses — so it is theirs to switch on.
    const songPaging = ref<SongPagingMode>('lists');
    // On by default: the phone on the hymnal stand dimming in verse three is
    // what this is for, and the lock is only ever held while a song is open, on
    // screen and being used — a quarter of an hour untouched and it stands down
    // by itself. Whoever would rather have the battery turns it off.
    const keepScreenAwake = ref(true);
    // Off by default: the first Web MIDI call raises a permission prompt, and
    // nobody looking up a hymn should be asked about MIDI hardware.
    const midiOutputEnabled = ref(false);
    const midiOutputId = ref('');
    // Off by default: the transport asks for the tempo in words, and the BPM
    // behind them is a control for whoever comes looking for it.
    const exactTempo = ref(false);
    // Off by default: playing a hymn in another key is a question whoever
    // leads the singing brings and a reader in a pew does not, so the control
    // is theirs to switch on. The offset itself starts at the printed key
    // every time either way — see playbackPitch.
    const pitchControl = ref(false);
    // Off by default: the references are machine-assigned. See PreferencesData.
    const showBibelstellen = ref(false);
    // Off by default: a hymnal first. Whoever wants the Bible to hand turns it on.
    const showBibel = ref(false);
    // Null until the reader sizes the Bible on its own: until then it follows
    // the song page, so whoever enlarged the hymns finds the Bible enlarged.
    const ownBibelScale = ref<number | null>(null);
    const bibelScale = computed(() => ownBibelScale.value ?? pageScale.value);
    const bibelDisplay = ref<BibelDisplaySettings>({ ...DEFAULT_BIBEL_DISPLAY });
    // Menge unless the reader chose Luther: one translation at a time.
    const bibelTranslation = ref<BibelTranslationId>('menge');
    // Only what the reader set; the rest follows DEFAULT_BIBEL_FEATURES.
    const chosenBibelFeatures = ref<Partial<BibelFeatures>>({});
    const bibelFeatures = computed<BibelFeatures>(() => ({
        ...DEFAULT_BIBEL_FEATURES,
        ...chosenBibelFeatures.value,
    }));
    const isLoading = ref(false);

    // Actions
    async function loadPreferences() {
        try {
            isLoading.value = true;

            // Load preferences from IndexedDB
            const prefs = await db.preferences.get('default');
            if (prefs) {
                pageScale.value = prefs.pageScale ?? migrateLegacyScale(prefs);
                xmlSettings.value = { ...DEFAULT_XML_SETTINGS, ...(prefs.xmlSettings || {}) };
                serviceTab.value = prefs.serviceTab ?? 'auto';
                songPaging.value = prefs.songPaging ?? 'lists';
                keepScreenAwake.value = prefs.keepScreenAwake ?? true;
                midiOutputEnabled.value = prefs.midiOutputEnabled ?? false;
                midiOutputId.value = prefs.midiOutputId ?? '';
                exactTempo.value = prefs.exactTempo ?? false;
                pitchControl.value = prefs.pitchControl ?? false;
                showBibelstellen.value = prefs.showBibelstellen ?? false;
                showBibel.value = prefs.showBibel ?? false;
                ownBibelScale.value = readBibelScale(prefs.bibelScale);
                bibelDisplay.value = readBibelDisplay(prefs.bibelDisplay);
                bibelTranslation.value = readBibelTranslation(prefs.bibelTranslation);
                chosenBibelFeatures.value = readChosenBibelFeatures(prefs.bibelFeatures);
            }
        } catch (err) {
            console.error('Error loading preferences:', err);
        } finally {
            isLoading.value = false;
        }
    }

    async function persist() {
        await db.preferences.put({
            id: 'default',
            pageScale: pageScale.value,
            // Spread to a plain object: IndexedDB cannot structured-clone the
            // reactive proxy behind xmlSettings.value (DataCloneError).
            xmlSettings: { ...xmlSettings.value },
            serviceTab: serviceTab.value,
            songPaging: songPaging.value,
            keepScreenAwake: keepScreenAwake.value,
            midiOutputEnabled: midiOutputEnabled.value,
            midiOutputId: midiOutputId.value,
            exactTempo: exactTempo.value,
            pitchControl: pitchControl.value,
            showBibelstellen: showBibelstellen.value,
            showBibel: showBibel.value,
            bibelScale: ownBibelScale.value ?? undefined,
            bibelDisplay: { ...bibelDisplay.value },
            bibelTranslation: bibelTranslation.value,
            bibelFeatures: { ...chosenBibelFeatures.value },
        });
    }

    async function setPageScale(scale: number) {
        try {
            pageScale.value = Math.max(MIN_PAGE_SCALE, Math.min(MAX_PAGE_SCALE, scale));
            await persist();
        } catch (err) {
            console.error('Error saving page scale:', err);
            throw err;
        }
    }

    async function setXmlSetting<K extends keyof XmlDisplaySettings>(
        key: K,
        value: XmlDisplaySettings[K],
    ) {
        try {
            xmlSettings.value = { ...xmlSettings.value, [key]: value };
            await persist();
        } catch (err) {
            console.error('Error saving XML setting:', err);
            throw err;
        }
    }

    async function setServiceTab(mode: ServiceTabMode) {
        try {
            serviceTab.value = mode;
            await persist();
        } catch (err) {
            console.error('Error saving the Gottesdienst tab setting:', err);
            throw err;
        }
    }

    async function setSongPaging(mode: SongPagingMode) {
        try {
            songPaging.value = mode;
            await persist();
        } catch (err) {
            console.error('Error saving the song paging setting:', err);
            throw err;
        }
    }

    async function setKeepScreenAwake(enabled: boolean) {
        try {
            keepScreenAwake.value = enabled;
            await persist();
        } catch (err) {
            console.error('Error saving the wake-lock setting:', err);
            throw err;
        }
    }

    async function setMidiOutputEnabled(enabled: boolean) {
        try {
            midiOutputEnabled.value = enabled;
            await persist();
        } catch (err) {
            console.error('Error saving the MIDI output setting:', err);
            throw err;
        }
    }

    async function setMidiOutputId(id: string) {
        try {
            midiOutputId.value = id;
            await persist();
        } catch (err) {
            console.error('Error saving the MIDI device:', err);
            throw err;
        }
    }

    async function setExactTempo(enabled: boolean) {
        try {
            exactTempo.value = enabled;
            await persist();
        } catch (err) {
            console.error('Error saving the tempo setting:', err);
            throw err;
        }
    }

    async function setPitchControl(enabled: boolean) {
        try {
            pitchControl.value = enabled;
            await persist();
        } catch (err) {
            console.error('Error saving the Tonhöhe setting:', err);
            throw err;
        }
    }

    async function setShowBibelstellen(enabled: boolean) {
        try {
            showBibelstellen.value = enabled;
            await persist();
        } catch (err) {
            console.error('Error saving the Bibelstellen setting:', err);
            throw err;
        }
    }

    async function setShowBibel(enabled: boolean) {
        try {
            showBibel.value = enabled;
            await persist();
        } catch (err) {
            console.error('Error saving the Bibel setting:', err);
            throw err;
        }
    }

    async function setBibelScale(scale: number) {
        try {
            ownBibelScale.value = clampScale(scale);
            await persist();
        } catch (err) {
            console.error('Error saving the Bible size:', err);
            throw err;
        }
    }

    async function setBibelDisplay<K extends keyof BibelDisplaySettings>(
        key: K,
        value: BibelDisplaySettings[K],
    ) {
        try {
            bibelDisplay.value = { ...bibelDisplay.value, [key]: value };
            await persist();
        } catch (err) {
            console.error('Error saving the Bible display setting:', err);
            throw err;
        }
    }

    async function setBibelTranslation(translation: BibelTranslationId) {
        try {
            bibelTranslation.value = translation;
            await persist();
        } catch (err) {
            console.error('Error saving the Bible translation:', err);
            throw err;
        }
    }

    async function setBibelFeature<K extends keyof BibelFeatures>(key: K, value: boolean) {
        try {
            chosenBibelFeatures.value = { ...chosenBibelFeatures.value, [key]: value };
            await persist();
        } catch (err) {
            console.error('Error saving the Bible feature setting:', err);
            throw err;
        }
    }

    // Restore the defaults in Dexie AND in memory (used on logout). Clearing the
    // table alone is not enough: loadPreferences only overwrites state when a record
    // exists, so the previous user's settings would survive in memory.
    async function resetToDefaults(): Promise<void> {
        await db.preferences.delete('default');
        pageScale.value = 1.0;
        xmlSettings.value = { ...DEFAULT_XML_SETTINGS };
        serviceTab.value = 'auto';
        songPaging.value = 'lists';
        keepScreenAwake.value = true;
        midiOutputEnabled.value = false;
        midiOutputId.value = '';
        exactTempo.value = false;
        pitchControl.value = false;
        showBibelstellen.value = false;
        showBibel.value = false;
        ownBibelScale.value = null;
        bibelDisplay.value = { ...DEFAULT_BIBEL_DISPLAY };
        bibelTranslation.value = 'menge';
        chosenBibelFeatures.value = {};
    }

    // Initialize store on creation
    const initPromise = loadPreferences();

    return {
        // State
        pageScale,
        xmlSettings,
        serviceTab,
        songPaging,
        keepScreenAwake,
        midiOutputEnabled,
        midiOutputId,
        exactTempo,
        pitchControl,
        showBibelstellen,
        showBibel,
        bibelScale,
        bibelDisplay,
        bibelTranslation,
        bibelFeatures,
        isLoading,

        // Actions
        loadPreferences,
        setPageScale,
        setXmlSetting,
        setServiceTab,
        setSongPaging,
        setKeepScreenAwake,
        setMidiOutputEnabled,
        setMidiOutputId,
        setExactTempo,
        setPitchControl,
        setShowBibelstellen,
        setShowBibel,
        setBibelScale,
        setBibelDisplay,
        setBibelTranslation,
        setBibelFeature,
        resetToDefaults,

        // Initialization promise
        initPromise,
    };
});
