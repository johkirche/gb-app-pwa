import { readonly, ref } from 'vue';

import { markSettingChanged, registerSyncedSetting } from '@/services/userData/settingsSync';

export type ThemePreference = 'system' | 'light' | 'dark';

function isThemePreference(value: unknown): value is ThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
}

// Frozen contract: this key is named verbatim on the Datenschutz page and
// removed by errorHandler.clearAllLocalData() — do not rename.
const THEME_STORAGE_KEY = 'settings.theme';

const theme = ref<ThemePreference>(readStoredTheme());
const isDark = ref(false);

let initialized = false;

function readStoredTheme(): ThemePreference {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (isThemePreference(saved)) return saved;
    } catch {
        // ignore storage errors
    }
    return 'system';
}

function applyTheme(preference: ThemePreference) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = preference === 'dark' || (preference === 'system' && prefersDark);
    isDark.value = dark;
    document.documentElement.classList.toggle('dark', dark);
}

function storeTheme(preference: ThemePreference) {
    theme.value = preference;
    try {
        localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
        // ignore storage errors
    }
    applyTheme(preference);
}

// The device keeps the theme so the first frame is drawn in it; the account
// carries it to the reader's other devices (services/userData/settingsSync).
registerSyncedSetting('theme', {
    read: () => theme.value,
    apply: (value) => {
        if (isThemePreference(value) && value !== theme.value) storeTheme(value);
    },
});

/**
 * Single owner of the theme preference (`settings.theme`: system|light|dark).
 * Call `initTheme()` once on app startup; use `setTheme()` from settings UI.
 */
export function useTheme() {
    function initTheme() {
        if (initialized) return;
        initialized = true;
        applyTheme(theme.value);
        // Follow OS changes while in 'system' mode
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (theme.value === 'system') applyTheme('system');
        });
    }

    function setTheme(preference: ThemePreference) {
        storeTheme(preference);
        void markSettingChanged('theme');
    }

    return { theme: readonly(theme), isDark: readonly(isDark), initTheme, setTheme };
}
