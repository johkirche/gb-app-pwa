import { watch } from 'vue';

import { toast } from 'vue-sonner';

import { useSongsStore } from '@/stores/songs';
import { useUserStore } from '@/stores/user';

import { mayUseMobileData } from '@/utils/mobileData';

/**
 * Bringing a corrected Gesangbuch to the device without the reader asking.
 *
 * A sync used to run only when someone started one — the first download,
 * pulling the song list, the button under Synchronisieren — so a fix made on
 * the server reached a reader only if they happened to sync. (The first one
 * this was noticed on: Lied 275's triplets, 2026-11-13.) Now the app asks the
 * server whether anything moved when it is opened, when it comes back to the
 * foreground, when it goes online and when a session begins: two counts,
 * ~100 bytes (countPendingUpdates).
 *
 * What it does about an answer depends on what fetching it would cost:
 *   - a handful of songs, or a device that cannot be on a data plan: it syncs
 *     at once, and says so when it is done;
 *   - more than that on a handheld that may be on mobile data: it asks, once
 *     per session, as the first download asks (mayUseMobileData).
 *
 * Nothing here can get in the way of reading. A check that fails says nothing,
 * and a sync that fails leaves no error on the page (syncAll's `quiet`) — only
 * the files it could not fetch, which the Synchronisieren page lists as after
 * any sync. The open song is left alone too: SongPage keeps the record and
 * notation it opened with, and finds the new ones the next time it opens.
 */

/**
 * Up to this many songs, an update is fetched without asking. A song is a
 * record of ~2 KB and two notation files of ~7.5 KB each (see
 * NOTATION_BUNDLE_MIN_FILES), so 25 of them come to about 400 KB.
 */
export const SMALL_UPDATE_SONGS = 25;

/** Coming back to the app every few minutes is no reason to ask again each time. */
export const CHECK_INTERVAL_MS = 15 * 60_000;

export type UpdateAction = 'none' | 'sync' | 'ask';

/** What to do about `pending` songs (countPendingUpdates) on this device. */
export function updateAction(pending: number | null, mobileData: boolean): UpdateAction {
    if (pending === null || pending <= 0) return 'none';
    if (pending <= SMALL_UPDATE_SONGS || !mobileData) return 'sync';
    return 'ask';
}

let started = false;
let checking = false;
// Only a check that got an answer counts: one that failed is tried again on
// the next return to the app, not a quarter of an hour later.
let lastAnswered = 0;
let asked = false;

async function bringUpToDate(): Promise<void> {
    const songsStore = useSongsStore();
    if (songsStore.isSyncing) return;

    try {
        await songsStore.syncAll({ quiet: true });
    } catch {
        // syncAll has logged it. Nobody asked for this sync, so nobody is told
        // it failed; the next check tries again.
        return;
    }

    if (songsStore.failedFiles.length === 0) {
        toast.success('Das Gesangbuch wurde aktualisiert.', { duration: 2500 });
    }
}

/** Ask the server whether anything moved, and act on the answer. */
export async function checkLibraryUpdates(): Promise<void> {
    const songsStore = useSongsStore();
    const userStore = useUserStore();

    if (checking || songsStore.isSyncing) return;
    if (!userStore.isLoggedIn || songsStore.isDemo || !songsStore.hasSongs) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (lastAnswered && Date.now() - lastAnswered < CHECK_INTERVAL_MS) return;

    checking = true;
    try {
        const pending = await songsStore.countPendingUpdates();
        if (pending === null) return;
        lastAnswered = Date.now();

        const action = updateAction(pending, mayUseMobileData());
        if (action === 'sync') {
            await bringUpToDate();
        } else if (action === 'ask' && !asked) {
            asked = true;
            toast.info(`Neuerungen für ${pending} Lieder`, {
                description: 'Jetzt laden, oder später im WLAN unter Synchronisieren.',
                duration: 15_000,
                action: { label: 'Jetzt laden', onClick: () => void bringUpToDate() },
            });
        }
    } finally {
        checking = false;
    }
}

/** Wire the check to the app's life. Called once, from the shell, after the stores have loaded. */
export function startLibraryUpdates(): void {
    if (started) return;
    started = true;

    const check = () => void checkLibraryUpdates();

    if (typeof window !== 'undefined') {
        window.addEventListener('online', check);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
        });
    }

    // The session is restored after the shell has mounted, and a sign-in can
    // bring one back to a device that already holds the book.
    const userStore = useUserStore();
    watch(
        () => userStore.isLoggedIn,
        (loggedIn) => {
            if (loggedIn) check();
        },
    );

    check();
}
