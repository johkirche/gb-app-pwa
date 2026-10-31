import { type Ref, readonly, ref, shallowRef } from 'vue';

import { type Rechtstexte, fetchRechtstexte, toRechtstexte } from '@/api/rechtstexte.api';
import { db } from '@/db';

/**
 * The Impressum's and Datenschutzerklärung's organisation texts, kept on the
 * device: shown at once from what was stored, then asked for anew whenever a
 * page with them opens online. An app that has never been online has none to
 * show, and says so.
 */

const META_KEY = 'rechtstexte';

const texte = shallowRef<Rechtstexte | null>(null);
/** 'loading' until the stored copy is read; 'missing' when there is none, and none could be fetched. */
const state = ref<'loading' | 'ready' | 'missing'>('loading');

let stored: Promise<void> | null = null;

function readStored(): Promise<void> {
    stored ??= (async () => {
        try {
            const row = await db.meta.get(META_KEY);
            if (row?.value) texte.value = toRechtstexte(JSON.parse(row.value));
        } catch (err) {
            console.error('Error reading the stored Rechtstexte:', err);
        }
    })();
    return stored;
}

async function refresh() {
    await readStored();
    try {
        const fresh = await fetchRechtstexte();
        texte.value = fresh;
        await db.meta.put({ key: META_KEY, value: JSON.stringify(fresh) });
    } catch (err) {
        // Offline, or the server cannot be reached: the stored copy stands.
        console.warn('Could not fetch the Rechtstexte:', err);
    }
    state.value = texte.value ? 'ready' : 'missing';
}

export function useRechtstexte(): {
    texte: Readonly<Ref<Rechtstexte | null>>;
    state: Readonly<Ref<'loading' | 'ready' | 'missing'>>;
} {
    void refresh();
    return { texte: readonly(texte) as Readonly<Ref<Rechtstexte | null>>, state: readonly(state) };
}

/** For tests: forget what was read. */
export function resetRechtstexte() {
    texte.value = null;
    state.value = 'loading';
    stored = null;
}
