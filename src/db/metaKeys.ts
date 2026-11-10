/**
 * The rows of db.meta that are the reader's, not the library's.
 *
 * db.meta holds both kinds. Most of it is the downloaded library's
 * bookkeeping: when the songs were last synced, which files are current, a
 * demo's key, the cached Bibelstellen and Rechtstexte. These few rows are about
 * the reader instead: where they left off in the Bible, the Gottesdienst in
 * hand, and what the user-data sync knows — whose data the device holds, and
 * which settings were changed here and still wait to go up.
 *
 * Deleting the downloaded library (songsStore.clearAllData) clears the first
 * kind and keeps these. Losing the sync's rows there would let the account's
 * older settings overwrite ones just changed on this device.
 *
 * Named here, apart from their owners, so the songs store can keep them without
 * importing the sync and the stores behind it.
 */
export const META_KEYS = {
    bibleLastRead: 'bibel.lastRead',
    activeService: 'service.activeId',
    userDataOwner: 'userData.owner',
    syncedSettings: 'settings.synced',
} as const;

export const READER_META_KEYS: readonly string[] = Object.values(META_KEYS);
