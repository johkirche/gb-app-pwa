import { readonly, ref } from 'vue';

import { readProfileAkzent, writeProfileAkzent } from '@/api/profile.api';

/** The flourish color: the rules, song numbers and the Lied der Woche. */
export type Akzent = 'silber' | 'gold';

export const DEFAULT_AKZENT: Akzent = 'silber';

// Named on the Datenschutz page and removed by errorHandler.clearAllLocalData(),
// like settings.theme beside them — rename all three together or not at all.
const AKZENT_STORAGE_KEY = 'settings.akzent';
const AKZENT_SHOWN_STORAGE_KEY = 'settings.akzentSichtbar';

// Off until directus_users carries an `akzent` field the member policy may read
// and update. Until then every request would only come back refused, and the
// e2e replay aborts anything its recording cannot answer.
const PROFILE_SYNC = import.meta.env.VITE_AKZENT_PROFIL === 'true';

export function isAkzent(value: unknown): value is Akzent {
    return value === 'silber' || value === 'gold';
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
 * any request; the profile, where it is switched on, carries it to the next
 * device the reader logs in on.
 */
export function useAkzent() {
    function initAkzent() {
        applyAkzent(akzent.value);
    }

    function setAkzent(value: Akzent) {
        storeAkzent(value);
        if (PROFILE_SYNC) void writeProfileAkzent(value);
    }

    /** Take the profile's color, if it has one. Called after a login. */
    async function pullAkzentFromProfile() {
        if (!PROFILE_SYNC) return;
        const stored = await readProfileAkzent();
        if (isAkzent(stored) && stored !== akzent.value) storeAkzent(stored);
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
