import type { BibelPassage } from '@/db';
import { entriesOf, entriesOfLists, getList, listsOfKind } from '@/services/userData/repo';
import { toPassage } from '@/utils/bibelPassage';
import { refToPassage } from '@/utils/textRef';

import { entriesFromSongIds } from './plan';
import type { ServicePlanDraft, ServicePlanOffer, ServicePlanProvider } from './types';

/**
 * The playlists on this device, offered as ready-made orders of service.
 *
 * This is the reference implementation of {@link ServicePlanProvider}: it reads
 * the stored lists rather than the playlists store so that listing an offer
 * costs nothing but a read and needs no component alive. A backend provider
 * follows the same shape — the only difference is where the rows come from.
 */
export const playlistServicePlanProvider: ServicePlanProvider = {
    id: 'playlist',
    label: 'Aus einer Playlist',
    description: 'Eine vorbereitete Playlist als Ablauf übernehmen',

    async isAvailable() {
        return (await listsOfKind('collection')).length > 0;
    },

    async listOffers(): Promise<ServicePlanOffer[]> {
        const lists = await listsOfKind('collection');
        const entries = await entriesOfLists(lists.map((l) => l.id));

        return lists
            .map((list) => {
                const rows = entries.get(list.id) ?? [];
                const touched = [list.updatedAt, ...rows.map((e) => e.updatedAt)].sort().at(-1)!;
                return {
                    list,
                    touched,
                    songCount: rows.filter((e) => e.kind === 'song' && e.songId).length,
                };
            })
            .filter((offer) => offer.songCount > 0)
            .sort((a, b) => b.touched.localeCompare(a.touched))
            .map(({ list, songCount }) => ({
                id: list.id,
                title: list.name ?? '',
                emoji: list.emoji ?? '🎵',
                songCount,
            }));
    },

    async loadOffer(offerId: string): Promise<ServicePlanDraft | null> {
        const list = await getList(offerId);
        if (!list || list.kind !== 'collection') return null;
        const rows = await entriesOf(offerId);
        const songIds = rows.filter((e) => e.kind === 'song' && e.songId).map((e) => e.songId!);
        const lesungen = rows
            .filter((e) => e.kind === 'passage' && e.work && e.ref)
            .map((e) => toPassage(refToPassage({ work: e.work!, ref: e.ref!, refEnd: e.refEnd })))
            .filter((p): p is BibelPassage => p !== null);

        return {
            title: list.name ?? '',
            entries: entriesFromSongIds(songIds),
            // A playlist's passages become the service's Lesungen.
            ...(lesungen.length ? { lesungen } : {}),
        };
    },
};
