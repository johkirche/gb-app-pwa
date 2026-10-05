import { computed, readonly, ref } from 'vue';

import { BIBEL_BOOKS } from '@/utils/bibel';
import { downloadBible, offlineBookSlugs } from '@/utils/bibelOffline';

/**
 * Whether the Bible is on the device, and the download that puts it there.
 *
 * Module state, shared by every place that shows it: a download started on
 * the Bibel tab is still running, with its progress, when the reader opens
 * the settings — and is not started a second time from there.
 */

const total = BIBEL_BOOKS.length;
/** Books in the cache; null until asked, or where there is no Cache Storage. */
const available = ref<number | null>(null);
const supported = ref(true);
const downloading = ref(false);
/** Books that failed in the last run; 0 when it went through. */
const failed = ref(0);

async function refresh(): Promise<void> {
    if (downloading.value) return;
    const slugs = await offlineBookSlugs();
    supported.value = slugs !== null;
    available.value = slugs?.size ?? null;
}

async function download(): Promise<void> {
    if (downloading.value) return;
    downloading.value = true;
    failed.value = 0;
    try {
        const result = await downloadBible((progress) => {
            available.value = progress.available;
        });
        available.value = result.available;
        failed.value = result.failed.length;
    } catch (error) {
        console.error('Error downloading the Bible:', error);
        failed.value = total - (available.value ?? 0);
    } finally {
        downloading.value = false;
    }
}

export function useBibelOffline() {
    return {
        total,
        available: readonly(available),
        supported: readonly(supported),
        downloading: readonly(downloading),
        failed: readonly(failed),
        complete: computed(() => available.value === total),
        refresh,
        download,
    };
}
