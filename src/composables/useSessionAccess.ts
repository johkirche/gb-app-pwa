import { computed } from 'vue';

import { useSongsStore } from '@/stores/songs';
import { useUserStore } from '@/stores/user';

/**
 * What this device may currently do — the view-level counterpart to the router's
 * `meta.access` (see `src/router/index.ts`).
 *
 * The guard answers one question, once, at the door: may this view open at all?
 * Inside a view the question is finer-grained, because a single page can hold
 * both kinds of thing — the Synchronisieren page reports what is stored offline
 * *and* fetches from Directus. So the guard lets the page open on the strength of
 * the downloaded Gesangbuch, and the page uses this to gate the one button that
 * needs an account.
 *
 * The rule for callers: gate a server feature on `isLoggedIn`, never on
 * `isGuest`. `isGuest` is for explaining the situation, not for deciding it —
 * a device with no session and no songs has no session either.
 */
export function useSessionAccess() {
    const userStore = useUserStore();
    const songsStore = useSongsStore();

    /** A live Directus session. The only thing that makes a server call possible. */
    const isLoggedIn = computed(() => userStore.isLoggedIn);

    /** Whose session it is, for views that report the state rather than gate on it. */
    const user = computed(() => userStore.user);

    /** A Gesangbuch on this device, readable with or without a session. */
    const hasLocalLibrary = computed(() => songsStore.hasSongs);

    /**
     * Reading songs with no session behind it: a demo's (see worker/demo.ts).
     * A book whose session ended does not get this far; it waits for its
     * reader's code (see the router's guard).
     */
    const isGuest = computed(() => !isLoggedIn.value && hasLocalLibrary.value);

    return { isLoggedIn, user, hasLocalLibrary, isGuest };
}
