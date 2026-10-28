import { readonly, ref } from 'vue';

import { readAppSettings, updateAppSettings } from '@/api/profile.api';

/** The flourish color: the rules, song numbers and the Lied der Woche. */
export type Akzent = 'silber' | 'gold';

export const DEFAULT_AKZENT: Akzent = 'silber';

// Named on the Datenschutz page and removed by errorHandler.clearAllLocalData(),
// like settings.theme beside them — rename all three together or not at all.
const AKZENT_STORAGE_KEY = 'settings.akzent';
const AKZENT_SHOWN_STORAGE_KEY = 'settings.akzentSichtbar';

export function isAkzent(value: unknown): value is Akzent {
    return value === 'silber' || value === 'gold';
}

// The profile's app_settings speaks English like the rest of directus_users,
// so the color is named there as `accent`: 'silver' | 'gold'.
const PROFILE_KEY = 'accent';
const TO_PROFILE: Record<Akzent, string> = { silber: 'silver', gold: 'gold' };

export function akzentFromProfile(value: unknown): Akzent | null {
    if (value === 'silver') return 'silber';
    if (value === 'gold') return 'gold';
    return null;
}

const akzent = ref<Akzent>(readStoredAkzent());
// The switch is not offered yet: whoever knows the code brings it up, and it
// stays up on this device until the code is entered again.
const akzentShown = ref(readStoredShown());

function readStoredShown(): boolean {
    try {
        return localStorage.getItem(AKZENT_SHOWN_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function readStoredAkzent(): Akzent {
    try {
        const saved = localStorage.getItem(AKZENT_STORAGE_KEY);
        if (isAkzent(saved)) return saved;
    } catch {
        // ignore storage errors
    }
    return DEFAULT_AKZENT;
}

function applyAkzent(value: Akzent) {
    document.documentElement.dataset.akzent = value;
}

function storeAkzent(value: Akzent) {
    akzent.value = value;
    try {
        localStorage.setItem(AKZENT_STORAGE_KEY, value);
    } catch {
        // ignore storage errors
    }
    applyAkzent(value);
}

/**
 * Single owner of the flourish color (`settings.akzent`: silber|gold), the
 * sibling of useTheme. The device keeps it so the page is drawn in it before
 * any request; the profile's app_settings carries it to the next device the
 * reader logs in on.
 */
export function useAkzent() {
    function initAkzent() {
        applyAkzent(akzent.value);
    }

    function setAkzent(value: Akzent) {
        storeAkzent(value);
        void updateAppSettings({ [PROFILE_KEY]: TO_PROFILE[value] });
    }

    /** Take the profile's color, if it has one. Called after a login. */
    async function pullAkzentFromProfile() {
        const stored = akzentFromProfile((await readAppSettings())?.[PROFILE_KEY]);
        if (stored && stored !== akzent.value) storeAkzent(stored);
    }

    /** Show the hidden switch, or hide it again. Returns whether it is shown now. */
    function toggleAkzentShown(): boolean {
        akzentShown.value = !akzentShown.value;
        try {
            if (akzentShown.value) localStorage.setItem(AKZENT_SHOWN_STORAGE_KEY, 'true');
            else localStorage.removeItem(AKZENT_SHOWN_STORAGE_KEY);
        } catch {
            // ignore storage errors
        }
        return akzentShown.value;
    }

    return {
        akzent: readonly(akzent),
        akzentShown: readonly(akzentShown),
        initAkzent,
        setAkzent,
        pullAkzentFromProfile,
        toggleAkzentShown,
    };
}
