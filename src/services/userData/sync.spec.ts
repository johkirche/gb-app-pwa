import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFavoritesStore } from '@/stores/favorites';
import { useMarkierungenStore } from '@/stores/markierungen';
import { usePlaylistsStore } from '@/stores/playlists';

import type { ServerEntry, ServerList, ServerMark } from '@/api/userData.api';
import { db } from '@/db';
import { resetDb } from '@/db/testing';
import { SESSION_ENDED_ERROR } from '@/services/errorHandler';

import { markServerId, singletonListId } from './ids';
import { markSettingChanged, registerSyncedSetting } from './settingsSync';
import { syncUserData, userDataSync } from './sync';

/**
 * A sync against a stand-in for the three Directus collections that behaves
 * the way the real ones were seen to on 2026-11-08: a batch create fails whole
 * on a duplicate id (RECORD_NOT_UNIQUE), a row that is not there answers 403,
 * and deleting a list deletes its entries. "Another device" is whatever a test
 * writes straight into it.
 */

const OWNER = '2b7e1516-28ae-4d2a-a6d2-15880988f7c1';

let clock = Date.parse('2026-11-08T10:00:00.000Z');
const tick = () => new Date((clock += 1000)).toISOString();

const server = {
    app_liste: new Map<string, ServerList>(),
    app_liste_eintrag: new Map<string, ServerEntry>(),
    app_markierung: new Map<string, ServerMark>(),
    settings: {} as Record<string, unknown>,
    sessionEnded: false,
};

function apiError(status: number, code: string) {
    return { errors: [{ message: code, extensions: { code } }], response: { status } };
}

vi.mock('@/api/userData.api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/userData.api')>();
    const table = (c: string) =>
        server[c as 'app_liste'] as unknown as Map<string, Record<string, unknown>>;
    const guard = () => {
        if (server.sessionEnded) throw new Error(SESSION_ENDED_ERROR);
    };
    return {
        ...actual,
        fetchOwnRows: async () => {
            guard();
            return {
                lists: [...server.app_liste.values()].map((r) => ({ ...r })),
                entries: [...server.app_liste_eintrag.values()].map((r) => ({ ...r })),
                marks: [...server.app_markierung.values()].map((r) => ({ ...r })),
            };
        },
        createRows: async (collection: string, rows: Record<string, unknown>[]) => {
            guard();
            const t = table(collection);
            if (rows.some((r) => t.has(r.id as string))) throw apiError(400, 'RECORD_NOT_UNIQUE');
            for (const row of rows) {
                const at = tick();
                t.set(row.id as string, {
                    official: false,
                    status: 'private',
                    ...row,
                    date_created: at,
                    date_updated: null,
                });
            }
        },
        updateRow: async (collection: string, id: string, data: Record<string, unknown>) => {
            guard();
            const t = table(collection);
            if (!t.has(id)) throw apiError(403, 'FORBIDDEN');
            t.set(id, { ...t.get(id), ...data, date_updated: tick() });
        },
        deleteRows: async (collection: string, ids: string[]) => {
            guard();
            const t = table(collection);
            if (ids.some((id) => !t.has(id))) throw apiError(403, 'FORBIDDEN');
            for (const id of ids) {
                t.delete(id);
                if (collection === 'app_liste') {
                    for (const [key, e] of server.app_liste_eintrag)
                        if (e.list === id) server.app_liste_eintrag.delete(key);
                }
            }
        },
    };
});

vi.mock('@/api/profile.api', () => ({
    readAppSettings: async () => structuredClone(server.settings),
    updateAppSettings: async (patch: Record<string, unknown>) => {
        server.settings = { ...server.settings, ...structuredClone(patch) };
        return true;
    },
}));

const user = { id: OWNER, email: 'a@example.com', role: 'Gesangbuchnutzer', activated: true };
vi.mock('@/stores/user', () => ({
    useUserStore: () => ({
        initPromise: Promise.resolve(),
        isLoggedIn: true,
        devSkipAuth: false,
        user,
        isTokenExpired: () => false,
        authData: { accessToken: 't' },
    }),
}));

function serverList(id: string, fields: Partial<ServerList> = {}): ServerList {
    return {
        id,
        kind: 'collection',
        status: 'private',
        name: null,
        emoji: null,
        gemeinde: null,
        service_type: null,
        date: null,
        time: null,
        keep: false,
        date_created: tick(),
        date_updated: null,
        ...fields,
    };
}

function serverEntry(id: string, list: string, fields: Partial<ServerEntry> = {}): ServerEntry {
    return {
        id,
        list,
        position: 'a0',
        kind: 'song',
        song: null,
        work: null,
        ref: null,
        ref_end: null,
        linked_list: null,
        verses: null,
        note: null,
        official: false,
        date_created: tick(),
        date_updated: null,
        ...fields,
    };
}

describe('syncUserData', () => {
    beforeEach(async () => {
        await resetDb();
        server.app_liste.clear();
        server.app_liste_eintrag.clear();
        server.app_markierung.clear();
        server.settings = {};
        server.sessionEnded = false;
        setActivePinia(createPinia());
    });

    it('uploads what was kept on the device before, and settles it', async () => {
        const playlists = usePlaylistsStore();
        const playlist = await playlists.createPlaylist('Erntedank', '🌾');
        await playlists.addSongsToPlaylist(playlist.id, ['10', '11']);
        await useFavoritesStore().addFavorite('20');
        await useMarkierungenStore().setColor('psalm', 23, [1], 'gelb');

        await syncUserData();

        expect(userDataSync.status).toBe('idle');
        expect(userDataSync.pending).toBe(0);
        expect(server.app_liste.get(playlist.id)).toMatchObject({
            kind: 'collection',
            name: 'Erntedank',
        });
        expect([...server.app_liste_eintrag.values()].map((e) => e.song).sort()).toEqual([
            10, 11, 20,
        ]);
        expect(server.app_liste.get(singletonListId(OWNER, 'favorites'))).toMatchObject({
            kind: 'favorites',
        });
        expect(server.app_markierung.get(markServerId(OWNER, 'bibel/psalm/23/1'))).toMatchObject({
            work: 'bibel',
            ref: 'psalm/23/1',
            color: 'yellow',
        });
        for (const table of [db.lists, db.listEntries, db.marks]) {
            expect(await table.where('dirty').equals(1).count()).toBe(0);
        }
    });

    it('brings in a playlist made on another device, and the stores show it', async () => {
        const playlists = usePlaylistsStore();
        await playlists.loadPlaylists();
        server.app_liste.set(
            'from-tablet',
            serverList('from-tablet', { name: 'Advent', emoji: '🕯️' }),
        );
        server.app_liste_eintrag.set('e1', serverEntry('e1', 'from-tablet', { song: 42 }));

        await syncUserData();

        expect(playlists.playlists).toEqual([
            expect.objectContaining({ id: 'from-tablet', name: 'Advent', songIds: ['42'] }),
        ]);
    });

    it('drops what another device deleted, and deletes there what was deleted here', async () => {
        const playlists = usePlaylistsStore();
        const keep = await playlists.createPlaylist('Bleibt');
        const gone = await playlists.createPlaylist('Geht anderswo');
        await syncUserData();

        // Deleted on the tablet …
        server.app_liste.delete(gone.id);
        // … and here.
        await playlists.deletePlaylist(keep.id);
        await syncUserData();

        expect(server.app_liste.size).toBe(0);
        expect(await db.lists.count()).toBe(0);
        expect(playlists.playlists).toEqual([]);
    });

    it('lets the later of two changes to the same row win', async () => {
        const playlists = usePlaylistsStore();
        const a = await playlists.createPlaylist('A');
        const b = await playlists.createPlaylist('B');
        await syncUserData();

        // A is renamed on the tablet first, then here: here wins.
        server.app_liste.set(a.id, {
            ...server.app_liste.get(a.id)!,
            name: 'A (Tablet)',
            date_updated: tick(),
        });
        clock += 60_000;
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(clock);
        await playlists.updatePlaylist(a.id, { name: 'A (hier)' });
        // B is renamed here first, then on the tablet: the tablet wins.
        await playlists.updatePlaylist(b.id, { name: 'B (hier)' });
        vi.useRealTimers();
        clock += 60_000;
        server.app_liste.set(b.id, {
            ...server.app_liste.get(b.id)!,
            name: 'B (Tablet)',
            date_updated: tick(),
        });

        await syncUserData();

        expect(server.app_liste.get(a.id)?.name).toBe('A (hier)');
        expect(playlists.getPlaylistById(b.id)?.name).toBe('B (Tablet)');
        expect(server.app_liste.get(b.id)?.name).toBe('B (Tablet)');
    });

    it('folds a Favoriten list made before the login into the account’s own', async () => {
        // Made on this device without an account, under the device's id.
        await db.lists.put({
            id: singletonListId(null, 'favorites'),
            kind: 'favorites',
            status: 'private',
            name: null,
            emoji: null,
            gemeinde: null,
            serviceType: null,
            date: null,
            time: null,
            keep: false,
            dirty: 1,
            deleted: 0,
            synced: 0,
            createdAt: tick(),
            updatedAt: tick(),
        });
        const favorites = useFavoritesStore();
        await favorites.loadFavorites();
        await favorites.addFavorite('7');
        // The account already has Favoriten, from the phone.
        server.app_liste.set('phone-favs', serverList('phone-favs', { kind: 'favorites' }));
        server.app_liste_eintrag.set('f1', serverEntry('f1', 'phone-favs', { song: 8 }));

        await syncUserData();

        expect(server.app_liste.size).toBe(1);
        expect(
            [...server.app_liste_eintrag.values()]
                .filter((e) => e.list === 'phone-favs')
                .map((e) => e.song)
                .sort(),
        ).toEqual([7, 8]);
        expect(favorites.favorites.map((f) => f.id).sort()).toEqual(['7', '8']);
    });

    it('keeps changes on the device while the session is over, and uploads them after', async () => {
        await syncUserData();
        server.sessionEnded = true;
        await useFavoritesStore().addFavorite('99');

        await syncUserData();
        expect(userDataSync.status).toBe('signedOut');
        expect(userDataSync.pending).toBeGreaterThan(0);
        expect(server.app_liste_eintrag.size).toBe(0);

        server.sessionEnded = false;
        await syncUserData();
        expect(userDataSync.pending).toBe(0);
        expect([...server.app_liste_eintrag.values()].map((e) => e.song)).toEqual([99]);
    });

    it('drops another account’s data from the device instead of uploading it', async () => {
        await db.meta.put({ key: 'userData.owner', value: 'someone-else' });
        await usePlaylistsStore().createPlaylist('Nicht meine');

        await syncUserData();

        expect(server.app_liste.size).toBe(0);
        expect(await db.lists.count()).toBe(0);
        expect((await db.meta.get('userData.owner'))?.value).toBe(OWNER);
    });

    it('takes a setting changed later on another device, and hands up one changed here', async () => {
        let here = 'here';
        registerSyncedSetting('test.a', {
            read: () => here,
            apply: (v) => void (here = v as string),
        });
        let other = 'unset';
        registerSyncedSetting('test.b', {
            read: () => other,
            apply: (v) => void (other = v as string),
        });
        server.settings = {
            synced: { 'test.b': { v: 'from the tablet', at: '2026-11-08T09:00:00.000Z' } },
        };

        // Nothing set here yet: nothing is written to the account.
        await syncUserData();
        expect(other).toBe('from the tablet');
        expect(server.settings.synced).not.toHaveProperty('test.a');

        here = 'set here';
        await markSettingChanged('test.a');
        await syncUserData();
        expect((server.settings.synced as Record<string, { v: unknown }>)['test.a'].v).toBe(
            'set here',
        );
        expect(userDataSync.pending).toBe(0);
    });
});
