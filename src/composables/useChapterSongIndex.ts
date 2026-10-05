import { type ComputedRef, computed, effectScope, shallowRef } from 'vue';

import { storeToRefs } from 'pinia';

import { useSongsStore } from '@/stores/songs';

import { type ChapterSongIndex, buildChapterSongIndex } from '@/utils/bibelLieder';
import { type BibelstellenData, loadBibelstellen } from '@/utils/bibelstellen';

// Shared by every caller: the passage data is one chunk, loaded once, and the
// index is rebuilt only when the library itself changes (a sync), not each
// time a chapter is turned.
const data = shallowRef<BibelstellenData | null>(null);
let requested = false;

function requestData() {
    if (requested) return;
    requested = true;
    loadBibelstellen()
        .then((loaded) => {
            data.value = loaded;
        })
        .catch((err: unknown) => {
            // Shown as nothing: the chapter reads the same without its songs.
            // The next caller may try again.
            requested = false;
            console.error('Error loading Bibelstellen:', err);
        });
}

let index: ComputedRef<ChapterSongIndex> | null = null;

/** Chapter → songs citing it; empty until the data and the songs are in. */
export function useChapterSongIndex(): ComputedRef<ChapterSongIndex> {
    requestData();
    if (!index) {
        const { songs } = storeToRefs(useSongsStore());
        // A detached scope: created inside the first component that asks, the
        // computed would otherwise be stopped when that component unmounts.
        index = effectScope(true).run(() =>
            computed(() =>
                data.value ? buildChapterSongIndex(data.value, songs.value) : new Map(),
            ),
        )!;
    }
    return index;
}
