import { db } from '@/db';

import { entriesFromSongIds } from './plan';
import type { ServicePlanDraft, ServicePlanOffer, ServicePlanProvider } from './types';

/**
 * The playlists on this device, offered as ready-made orders of service.
 *
 * This is the reference implementation of {@link ServicePlanProvider}: it reads
 * Dexie rather than the playlists store so that listing an offer costs nothing
 * but a read and needs no component alive. A backend provider follows the same
 * shape — the only difference is where the rows come from.
 */
export const playlistServicePlanProvider: ServicePlanProvider = {
    id: 'playlist',
    label: 'Aus einer Playlist',
    description: 'Eine vorbereitete Playlist für diesen Gottesdienst übernehmen',

    async isAvailable() {
        return (await db.playlists.count()) > 0;
    },

    async listOffers(): Promise<ServicePlanOffer[]> {
        const playlists = await db.playlists.toArray();

        return playlists
            .filter((playlist) => playlist.songIds.length > 0)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((playlist) => ({
                id: playlist.id,
                title: playlist.name,
                emoji: playlist.emoji,
                songCount: playlist.songIds.length,
            }));
    },

    async loadOffer(offerId: string): Promise<ServicePlanDraft | null> {
        const playlist = await db.playlists.get(offerId);
        if (!playlist) return null;

        return {
            title: playlist.name,
            entries: entriesFromSongIds(playlist.songIds),
        };
    },
};
