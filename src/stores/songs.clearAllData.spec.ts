import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db';
import { META_KEYS, READER_META_KEYS } from '@/db/metaKeys';
import { resetDb } from '@/db/testing';

import { useSongsStore } from './songs';

describe('clearAllData', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    it('deletes the library and its bookkeeping, and leaves the reader’s own rows', async () => {
        const store = useSongsStore();
        await store.initPromise;
        await db.songs.put({ id: '1', titel: 'Lobe den Herren' } as never);
        await db.files.put({ id: 'svg-1', blob: 'notes', filename: '1.svg' } as never);
        await db.meta.bulkPut([
            { key: 'lastSyncTime', value: '2026-11-08T10:00:00.000Z' },
            { key: 'fileStamps', value: '{}' },
            { key: 'demoKey', value: 'demo' },
            { key: 'rechtstexte', value: '{}' },
            { key: META_KEYS.bibleLastRead, value: 'psalm/23' },
            { key: META_KEYS.activeService, value: 'plan-1' },
            { key: META_KEYS.userDataOwner, value: 'user-1' },
            // A setting changed here and not uploaded yet: without this row
            // the next sync would take the account's older value over it.
            {
                key: META_KEYS.syncedSettings,
                value: '{"theme":{"at":"2026-11-08T10:00:00.000Z","dirty":true}}',
            },
        ]);

        await store.clearAllData();

        expect(await db.songs.count()).toBe(0);
        expect(await db.files.count()).toBe(0);
        expect((await db.meta.toCollection().primaryKeys()).sort()).toEqual(
            [...READER_META_KEYS].sort(),
        );
        expect(store.demoKey).toBeNull();
    });
});
