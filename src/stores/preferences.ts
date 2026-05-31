import { ref } from 'vue';

import { defineStore } from 'pinia';

import { type MelodyDisplayMode, type XmlDisplaySettings, db } from '@/db';

export interface PreferencesData {
    id: string;
    notationScale: number; // Scale factor for music notation (0.5 - 2.0)
    textSize: 'small' | 'medium' | 'large' | 'xlarge'; // Text size for song lyrics
    melodyDisplayMode: MelodyDisplayMode; // Display mode: image or MusicXML (OSMD)
    xmlSettings?: XmlDisplaySettings;
}

const DEFAULT_XML_SETTINGS: XmlDisplaySettings = {
    showMeasureNumbers: false,
    showLyrics: true,
};

export const usePreferencesStore = defineStore('preferences', () => {
    // State
    const notationScale = ref<number>(1.0); // Default scale
    const textSize = ref<'small' | 'medium' | 'large' | 'xlarge'>('medium'); // Default text size
    const melodyDisplayMode = ref<MelodyDisplayMode>('xml'); // Default to MusicXML notation
    const xmlSettings = ref<XmlDisplaySettings>({ ...DEFAULT_XML_SETTINGS });
    const isLoading = ref(false);

    // Actions
    async function loadPreferences() {
        try {
            isLoading.value = true;

            // Load preferences from IndexedDB
            const prefs = await db.preferences.get('default');
            if (prefs) {
                notationScale.value = prefs.notationScale;
                textSize.value = prefs.textSize;
                // Migrate legacy 'abc' mode (ABC player removed) to MusicXML
                const storedMode = prefs.melodyDisplayMode as MelodyDisplayMode | 'abc' | undefined;
                melodyDisplayMode.value = storedMode && storedMode !== 'abc' ? storedMode : 'xml';
                xmlSettings.value = { ...DEFAULT_XML_SETTINGS, ...(prefs.xmlSettings || {}) };
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
            notationScale: notationScale.value,
            textSize: textSize.value,
            melodyDisplayMode: melodyDisplayMode.value,
            xmlSettings: xmlSettings.value,
        });
    }

    async function setNotationScale(scale: number) {
        try {
            const clampedScale = Math.max(0.5, Math.min(2.0, scale));
            notationScale.value = clampedScale;
            await persist();
        } catch (err) {
            console.error('Error saving notation scale:', err);
            throw err;
        }
    }

    async function setTextSize(size: 'small' | 'medium' | 'large' | 'xlarge') {
        try {
            textSize.value = size;
            await persist();
        } catch (err) {
            console.error('Error saving text size:', err);
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

    // Initialize store on creation
    const initPromise = loadPreferences();

    return {
        // State
        notationScale,
        textSize,
        melodyDisplayMode,
        xmlSettings,
        isLoading,

        // Actions
        loadPreferences,
        setNotationScale,
        setTextSize,
        setMelodyDisplayMode,
        setXmlSetting,

        // Initialization promise
        initPromise,
    };
});
