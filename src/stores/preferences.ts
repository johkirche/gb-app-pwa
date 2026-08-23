import { ref } from 'vue';

import { defineStore } from 'pinia';

import { type MelodyDisplayMode, type ServiceTabMode, type XmlDisplaySettings, db } from '@/db';

const DEFAULT_XML_SETTINGS: XmlDisplaySettings = {
    showMeasureNumbers: false,
    showLyrics: true,
    // The playback marks are on by default: they are what the transport is for.
    // A record stored before they existed picks them up here, because
    // loadPreferences spreads these defaults under whatever it read.
    highlightNotes: true,
    showPlayhead: true,
};

const MIN_PAGE_SCALE = 0.5;
const MAX_PAGE_SCALE = 2.0;

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
    const melodyDisplayMode = ref<MelodyDisplayMode>('xml'); // Default to MusicXML notation
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

    // Actions
    async function loadPreferences() {
        try {
            isLoading.value = true;

            // Load preferences from IndexedDB
            const prefs = await db.preferences.get('default');
            if (prefs) {
                pageScale.value = prefs.pageScale ?? migrateLegacyScale(prefs);
                // Migrate legacy 'abc' mode (ABC player removed) to MusicXML
                const storedMode = prefs.melodyDisplayMode as MelodyDisplayMode | 'abc' | undefined;
                melodyDisplayMode.value = storedMode && storedMode !== 'abc' ? storedMode : 'xml';
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
            melodyDisplayMode: melodyDisplayMode.value,
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

    async function setMelodyDisplayMode(mode: MelodyDisplayMode) {
        try {
            melodyDisplayMode.value = mode;
            await persist();
        } catch (err) {
            console.error('Error saving melody display mode:', err);
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
        melodyDisplayMode.value = 'xml';
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
        melodyDisplayMode,
        xmlSettings,
        serviceTab,
        keepScreenAwake,
        midiOutputEnabled,
        midiOutputId,
        isLoading,

        // Actions
        loadPreferences,
        setPageScale,
        setMelodyDisplayMode,
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
