import { type ComputedRef, computed, effectScope } from 'vue';

import { storeToRefs } from 'pinia';

import { useSongsStore } from '@/stores/songs';

import { type ChapterSongIndex, buildChapterSongIndex } from '@/utils/bibelLieder';
import { bibelstellen, loadBibelstellen } from '@/utils/bibelstellen';

// Shared by every caller: the passage data is read from the device once, and
// the index is rebuilt only when the library or the synced file changes, not
// each time a chapter is turned.
let index: ComputedRef<ChapterSongIndex> | null = null;

/** Chapter → songs citing it; empty until the data and the songs are in, and
 *  for good where the hymnal offers no Bibelstellen. */
export function useChapterSongIndex(): ComputedRef<ChapterSongIndex> {
    loadBibelstellen().catch((err: unknown) => {
        // Shown as nothing: the chapter reads the same without its songs.
        console.error('Error loading Bibelstellen:', err);
    });
    if (!index) {
        const { songs } = storeToRefs(useSongsStore());
        // A detached scope: created inside the first component that asks, the
        // computed would otherwise be stopped when that component unmounts.
        index = effectScope(true).run(() =>
            computed(() =>
                bibelstellen.value
                    ? buildChapterSongIndex(bibelstellen.value, songs.value)
                    : new Map(),
            ),
        )!;
    }
    return index;
}
