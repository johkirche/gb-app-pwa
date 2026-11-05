import { ref, shallowRef } from 'vue';

import { fetchGemeinden } from '@/api/gemeinde.api';
import { type GemeindeOption, toGemeinden } from '@/utils/gemeinden';

/**
 * The Gemeinden, for the picker. Held at module level, so the onboarding and the
 * Einstellungen share one copy; nothing of it is stored, since the device keeps
 * only the one a reader chose, with their user (see useProfile).
 */

const gemeinden = shallowRef<GemeindeOption[]>([]);
const listState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
let run: Promise<void> | null = null;

function load(): Promise<void> {
    if (listState.value === 'ready') return Promise.resolve();
    if (!run) {
        listState.value = 'loading';
        run = fetchGemeinden()
            .then((rows) => {
                gemeinden.value = toGemeinden(rows);
                listState.value = 'ready';
            })
            .catch((err) => {
                console.warn('Could not list the Gemeinden:', err);
                listState.value = 'error';
            })
            .finally(() => {
                run = null;
            });
    }
    return run;
}

export function useGemeinden() {
    return { gemeinden, listState, load };
}
