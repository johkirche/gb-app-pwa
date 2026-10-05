import { computed, reactive } from 'vue';

import { storeToRefs } from 'pinia';

import { usePreferencesStore } from '@/stores/preferences';

import { BIBEL_BOOKS, type BibelTranslationId } from '@/utils/bibel';
import { BIBEL_DOWNLOAD_SIZES, downloadBible, offlineBookSlugs } from '@/utils/bibelOffline';

/**
 * Whether the Bible is on the device, and the download that puts it there —
 * for the translation the reader reads.
 *
 * Module state, shared by every place that shows it: a download started on
 * the Bibel tab is still running, with its progress, when the reader opens
 * the settings — and is not started a second time from there. Each
 * translation keeps its own, as each keeps its own cache.
 */

const total = BIBEL_BOOKS.length;

interface OfflineState {
    /** Books in the cache; null until asked, or where there is no Cache Storage. */
    available: number | null;
    supported: boolean;
    downloading: boolean;
    /** Books that failed in the last run; 0 when it went through. */
    failed: number;
}

function initialState(): OfflineState {
    return { available: null, supported: true, downloading: false, failed: 0 };
}

const states = reactive<Record<BibelTranslationId, OfflineState>>({
    menge: initialState(),
    luther1912: initialState(),
});

async function refresh(translation: BibelTranslationId): Promise<void> {
    const state = states[translation];
    if (state.downloading) return;
    const slugs = await offlineBookSlugs(translation);
    state.supported = slugs !== null;
    state.available = slugs?.size ?? null;
}

async function download(translation: BibelTranslationId): Promise<void> {
    const state = states[translation];
    if (state.downloading) return;
    state.downloading = true;
    state.failed = 0;
    try {
        const result = await downloadBible(
            (progress) => {
                state.available = progress.available;
            },
            3,
            translation,
        );
        state.available = result.available;
        state.failed = result.failed.length;
    } catch (error) {
        console.error('Error downloading the Bible:', error);
        state.failed = total - (state.available ?? 0);
    } finally {
        state.downloading = false;
    }
}

export function useBibelOffline() {
    const { bibelTranslation } = storeToRefs(usePreferencesStore());
    const state = computed(() => states[bibelTranslation.value]);
    return {
        total,
        translation: bibelTranslation,
        size: computed(() => BIBEL_DOWNLOAD_SIZES[bibelTranslation.value]),
        available: computed(() => state.value.available),
        supported: computed(() => state.value.supported),
        downloading: computed(() => state.value.downloading),
        failed: computed(() => state.value.failed),
        complete: computed(() => state.value.available === total),
        refresh: () => refresh(bibelTranslation.value),
        download: () => download(bibelTranslation.value),
    };
}
