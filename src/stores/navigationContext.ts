import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

/**
 * Where a song was opened from, and what lay around it there.
 *
 * The song page cannot tell on its own whether „das nächste Lied" means the
 * next number in the book, the next row of a filtered list or the next hymn of
 * the service — only the screen that was left knows the order it was showing.
 * So that screen hands the order over here on the way out, and the song page
 * reads it back to offer Vor and Zurück in exactly that order.
 *
 * In memory only, on purpose: a context describes a trip through the app, and
 * a fresh start has no trip behind it. The song page falls back to the book's
 * own numbering where there is nothing here (see `useSongNeighbours`).
 */
export type NavigationContextKind = 'list' | 'playlist' | 'service' | 'favorites';

export interface NavigationContext {
    kind: NavigationContextKind;
    /** What the bar under the song calls the order it is walking („Playlist Advent") */
    label: string;
    /** Song ids in the order they were on screen */
    songIds: string[];
}

export interface SongNeighbours {
    prevId: string | null;
    nextId: string | null;
    /** 1-based place of the current song in the order, 0 where it is not in it */
    position: number;
    total: number;
}

/**
 * The songs either side of `songId` in `songIds`.
 *
 * A song that is not in the order at all has no neighbours in it — the caller
 * decides what to walk instead. Duplicate ids (a playlist can hold the same
 * hymn twice) are walked as the rows they are: the first occurrence is what
 * the song page lands on, and its neighbours are the rows either side of it.
 */
export function neighboursIn(songIds: readonly string[], songId: string): SongNeighbours {
    const index = songIds.indexOf(songId);
    if (index === -1) {
        return { prevId: null, nextId: null, position: 0, total: songIds.length };
    }

    return {
        prevId: index > 0 ? songIds[index - 1] : null,
        nextId: index < songIds.length - 1 ? songIds[index + 1] : null,
        position: index + 1,
        total: songIds.length,
    };
}

export const useNavigationContextStore = defineStore('navigationContext', () => {
    const context = ref<NavigationContext | null>(null);

    const hasContext = computed(() => context.value !== null);

    /**
     * Called by a list on its way into a song. `songIds` is copied so a list
     * that keeps re-sorting itself after the reader has left does not move the
     * ground under the song page.
     */
    function setContext(next: NavigationContext): void {
        context.value = { ...next, songIds: [...next.songIds] };
    }

    function clear(): void {
        context.value = null;
    }

    return {
        context,
        hasContext,
        setContext,
        clear,
    };
});
