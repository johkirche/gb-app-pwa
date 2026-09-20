import { toast } from 'vue-sonner';

import type { Song } from '@/db';
import { hymnLink } from '@/utils/hymnNumber';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

/**
 * How a link leaves the app on this device.
 *
 * The share sheet is the phone's way: it offers the messenger the choir is on.
 * At a desk the same sheet is a detour — the link is going into a bulletin or
 * an e-mail that is already open, so the clipboard is the answer there, said
 * with a toast because a copy has no other way to show it happened. „At a
 * desk" is read off the pointer, not the screen size: a touch laptop shares
 * like a phone, a wide screen with a mouse copies.
 */
export function preferShareSheet(nav: Navigator = navigator, win: Window = window): boolean {
    if (typeof nav.share !== 'function') return false;
    return win.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/** What the share sheet is handed: the hymn as it is announced, and its link. */
export function shareDataFor(song: Pick<Song, 'id' | 'index' | 'titel'>, origin: string) {
    const title = song.index > 0 ? `${song.index}. ${song.titel}` : song.titel;
    return {
        title,
        text: `${title} – Gesangbuch der Johannischen Kirche`,
        url: hymnLink(song, origin),
    };
}

/**
 * Share a song, or copy its link where sharing is not the way.
 *
 * A dismissed share sheet is not a failure and says nothing; a copy that
 * cannot reach the clipboard tries the sheet, if there is one, before giving
 * up — so a link is only ever lost where the device offers no way out at all.
 */
export async function shareSong(song: Pick<Song, 'id' | 'index' | 'titel'>): Promise<ShareOutcome> {
    const data = shareDataFor(song, window.location.origin);
    const canShare =
        typeof navigator.share === 'function' &&
        (typeof navigator.canShare !== 'function' || navigator.canShare(data));

    if (canShare && preferShareSheet()) {
        return openShareSheet(data);
    }

    const copied = await copyLink(data.url);
    if (copied) return 'copied';

    if (canShare) return openShareSheet(data);

    toast.error('Der Link konnte nicht kopiert werden.', { description: data.url });
    return 'failed';
}

async function openShareSheet(data: ShareData): Promise<ShareOutcome> {
    try {
        await navigator.share(data);
        return 'shared';
    } catch (err) {
        // Closing the sheet rejects with AbortError: the reader changed their
        // mind, which is not something to report back to them.
        if (err instanceof DOMException && err.name === 'AbortError') return 'dismissed';
        console.warn('Share sheet failed, copying instead:', err);
        const copied = await copyLink(data.url ?? '');
        if (copied) return 'copied';
        toast.error('Der Link konnte nicht geteilt werden.', { description: data.url });
        return 'failed';
    }
}

async function copyLink(url: string): Promise<boolean> {
    if (!url || typeof navigator.clipboard?.writeText !== 'function') return false;
    try {
        await navigator.clipboard.writeText(url);
        toast.success('Link kopiert', { description: url, duration: 3000 });
        return true;
    } catch (err) {
        console.warn('Clipboard write failed:', err);
        return false;
    }
}
