import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { useLesezeichenStore } from '@/stores/lesezeichen';
import { useMarkierungenStore } from '@/stores/markierungen';
import { useNotizenStore } from '@/stores/notizen';
import { usePreferencesStore } from '@/stores/preferences';

import { stellen } from '@/utils/meineStellen';

/**
 * Every verse the reader has kept, newest first — of the features switched
 * on only. A feature switched off hides its marks rather than deleting them,
 * so they must not be shown here, nor cleared with the rows that are.
 */
export function useStellen() {
    const lesezeichen = useLesezeichenStore();
    const markierungen = useMarkierungenStore();
    const notizen = useNotizenStore();
    const { bibelFeatures } = storeToRefs(usePreferencesStore());

    return computed(() =>
        stellen(
            bibelFeatures.value.lesezeichen ? lesezeichen.lesezeichen : [],
            bibelFeatures.value.notizen ? markierungen.markierungen : [],
            bibelFeatures.value.notizen ? notizen.notizen : [],
        ),
    );
}
