import { db } from '@/db';

/**
 * Empty every table. The specs run against a real Dexie database on the
 * in-memory IndexedDB of fake-indexeddb (vite.config.ts), one per spec file,
 * so a spec empties it before each test.
 */
export async function resetDb(): Promise<void> {
    await Promise.all(db.tables.map((table) => table.clear()));
}
