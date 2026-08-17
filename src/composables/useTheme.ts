import { readonly, ref } from 'vue';

export type ThemePreference = 'system' | 'light' | 'dark';

// Frozen contract: this key is named verbatim on the Datenschutz page and
// removed by errorHandler.clearAllLocalData() — do not rename.
const THEME_STORAGE_KEY = 'settings.theme';

const theme = ref<ThemePreference>(readStoredTheme());
const isDark = ref(false);

let initialized = false;

function readStoredTheme(): ThemePreference {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
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
    // Transitional: keep Ionic's palette class in sync until the last Ionic
    // view is migrated (OsmdRenderer and dark.class.css still watch it).
    document.documentElement.classList.toggle('ion-palette-dark', dark);
}

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
        theme.value = preference;
        try {
            localStorage.setItem(THEME_STORAGE_KEY, preference);
        } catch {
            // ignore storage errors
        }
        applyTheme(preference);
    }

    return { theme: readonly(theme), isDark: readonly(isDark), initTheme, setTheme };
}
