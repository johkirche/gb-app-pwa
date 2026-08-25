import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import {
    type MelodyDisplayMode,
    type NotationBeyondFit,
    type ServiceTabMode,
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

/**
 * What holds past the fit width until somebody says otherwise. Whoever enlarges
 * a song wants to read it, and re-breaking the systems gives them big *and*
 * whole, where the engraving can only give them big and pushed sideways.
 *
 * This is a one-line default: if it turns out in use that people would rather
 * keep the setting they know from the book, turn it round.
 */
const DEFAULT_BEYOND_FIT: NotationBeyondFit = 'reflow';

const MIN_PAGE_SCALE = 0.5;
const MAX_PAGE_SCALE = 2.0;

/** What the retired Textgröße steps were worth, as factors of the default. */
const LEGACY_TEXT_SIZE_SCALE = {
    small: 0.889,
    medium: 1,
    large: 1.167,
    xlarge: 1.333,
} as const;

/**
 * What a reader who had picked „Notenbild" meant by it.
 *
 * The two notations used to be a standing choice; they are one view now, and
 * the only place the choice still bites is past the fit width. „MusicXML" was
 * also the default, so it says nothing about what anybody wanted — but whoever
 * went out of their way to pick the engraved page meant to keep it, and keeping
 * it is exactly what „Notenbild behalten" does.
 */
function migrateLegacyMelodyMode(mode: MelodyDisplayMode | undefined): NotationBeyondFit | null {
    return mode === 'image' ? 'engraving' : null;
}

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
    const notationBeyondFit = ref<NotationBeyondFit | null>(null);
    const xmlSettings = ref<XmlDisplaySettings>({ ...DEFAULT_XML_SETTINGS });
    // 'auto' keeps the tab bar as it was for everyone who never holds a service;
    // whoever leads the music pins it once and always has it.
    const serviceTab = ref<ServiceTabMode>('auto');
    // On by default: the phone on the hymnal stand dimming in verse three is
    // what this is for, and the lock is only ever held while a song is open
    // and on screen. Whoever would rather have the battery turns it off.
    const keepScreenAwake = ref(true);
    // Off by default: the first Web MIDI call raises a permission prompt, and
    // nobody looking up a hymn should be asked about MIDI hardware.
    const midiOutputEnabled = ref(false);
    const midiOutputId = ref('');
    const isLoading = ref(false);

    /** The setting as the melody view should read it */
    const beyondFit = computed<NotationBeyondFit>(
        () => notationBeyondFit.value ?? DEFAULT_BEYOND_FIT,
    );
    /** Whether it has ever been chosen — which is what puts it in Einstellungen */
    const beyondFitChosen = computed(() => notationBeyondFit.value !== null);

    // Actions
    async function loadPreferences() {
        try {
            isLoading.value = true;

            // Load preferences from IndexedDB
            const prefs = await db.preferences.get('default');
            if (prefs) {
                pageScale.value = prefs.pageScale ?? migrateLegacyScale(prefs);
                // 'abc' is older still (the ABC player is gone) and says nothing.
                const storedMode = prefs.melodyDisplayMode as MelodyDisplayMode | 'abc' | undefined;
                notationBeyondFit.value =
                    prefs.notationBeyondFit ??
                    migrateLegacyMelodyMode(storedMode === 'abc' ? undefined : storedMode);
                xmlSettings.value = { ...DEFAULT_XML_SETTINGS, ...(prefs.xmlSettings || {}) };
                serviceTab.value = prefs.serviceTab ?? 'auto';
                keepScreenAwake.value = prefs.keepScreenAwake ?? true;
                midiOutputEnabled.value = prefs.midiOutputEnabled ?? false;
                midiOutputId.value = prefs.midiOutputId ?? '';
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
            notationBeyondFit: notationBeyondFit.value ?? undefined,
            // Spread to a plain object: IndexedDB cannot structured-clone the
            // reactive proxy behind xmlSettings.value (DataCloneError).
            xmlSettings: { ...xmlSettings.value },
            serviceTab: serviceTab.value,
            keepScreenAwake: keepScreenAwake.value,
            midiOutputEnabled: midiOutputEnabled.value,
            midiOutputId: midiOutputId.value,
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

    async function setNotationBeyondFit(mode: NotationBeyondFit) {
        try {
            notationBeyondFit.value = mode;
            await persist();
        } catch (err) {
            console.error('Error saving the enlarged-notation setting:', err);
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

    // Restore the defaults in Dexie AND in memory (used on logout). Clearing the
    // table alone is not enough: loadPreferences only overwrites state when a record
    // exists, so the previous user's settings would survive in memory.
    async function resetToDefaults(): Promise<void> {
        await db.preferences.delete('default');
        pageScale.value = 1.0;
        notationBeyondFit.value = null;
        xmlSettings.value = { ...DEFAULT_XML_SETTINGS };
        serviceTab.value = 'auto';
        keepScreenAwake.value = true;
        midiOutputEnabled.value = false;
        midiOutputId.value = '';
    }

    // Initialize store on creation
    const initPromise = loadPreferences();

    return {
        // State
        pageScale,
        notationBeyondFit,
        beyondFit,
        beyondFitChosen,
        xmlSettings,
        serviceTab,
        keepScreenAwake,
        midiOutputEnabled,
        midiOutputId,
        isLoading,

        // Actions
        loadPreferences,
        setPageScale,
        setNotationBeyondFit,
        setXmlSetting,
        setServiceTab,
        setKeepScreenAwake,
        setMidiOutputEnabled,
        setMidiOutputId,
        resetToDefaults,

        // Initialization promise
        initPromise,
    };
});
