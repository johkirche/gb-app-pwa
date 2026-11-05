import { fetchFile, findFileByName } from '@/api/files.api';
import { db } from '@/db';
import { isSessionEndedError } from '@/services/errorHandler';
import { readNotationBundle, sameFileStamp } from '@/utils/notationBundle';
import type { ManifestFile } from '@/utils/syncDiff';

/**
 * The notation archive in Directus, which turns a first download from 1140
 * requests into two.
 *
 * Its name is the contract with directus-notation-bundle-extension, which builds
 * it, and it is only ever an accelerator: whatever it does not supply, the
 * per-file path fetches as before. So a missing, stale, broken or unreadable
 * archive can make a sync slower, never wrong, and never fail it.
 */
export const NOTATION_BUNDLE_FILENAME = 'gesangbuch-noten.tar.gz';

/**
 * How many files have to be wanted before the archive is worth asking for. A
 * few changed files are cheaper one by one: 200 files cost ~1.5 MB singly
 * against ~7 MB for the archive. The real cases are a handful or nearly all, and
 * for both of those the choice is clear.
 */
export const NOTATION_BUNDLE_MIN_FILES = 200;

// Each chunk is a transaction of its own, so a storage failure keeps what is
// already in and the reader sees the count move.
const STORE_CHUNK_SIZE = 100;

/**
 * Store what the archive can vouch for, and report the ids it stored.
 *
 * A file is taken only if it is wanted and its stamp in the archive names the
 * same moment as the manifest's. That is all the trust there is: a file replaced
 * in Directus since the build carries an old stamp, and goes through the per-file
 * path like anything else this returns without.
 *
 * Every failure ends in a warning and the ids stored so far, including a full
 * disk: the per-file path then runs into it too and says so in its own words.
 * The one exception is a session that ended, which the sync has to hear about.
 */
export async function syncNotationBundle(
    wanted: ManifestFile[],
    filenameOf: (fileId: string) => string,
    onProgress: (current: number, total: number) => void,
): Promise<string[]> {
    if (wanted.length < NOTATION_BUNDLE_MIN_FILES || typeof DecompressionStream === 'undefined') {
        return [];
    }

    const stored: string[] = [];

    try {
        const info = await findFileByName(NOTATION_BUNDLE_FILENAME);
        if (!info) return stored;

        // A rebuild replaces the archive in place, so its URL stays the same and
        // the browser may answer it from its HTTP cache for as long as /assets
        // allows. A device reading last time's archive matches nothing and goes
        // per-file, and a re-export is exactly when the archive should pay off.
        const { files } = await readNotationBundle(await fetchFile(info.id, { cache: 'no-cache' }));

        const stamps = new Map(wanted.map((file) => [file.id, file.modifiedOn]));
        const usable = files.filter((file) => {
            const stamp = stamps.get(file.id);
            return stamp !== undefined && sameFileStamp(file.modifiedOn, stamp);
        });

        onProgress(0, usable.length);
        for (let i = 0; i < usable.length; i += STORE_CHUNK_SIZE) {
            const chunk = usable.slice(i, i + STORE_CHUNK_SIZE);
            await db.files.bulkPut(
                chunk.map(({ id, blob }) => ({ id, blob, filename: filenameOf(id) })),
            );
            stored.push(...chunk.map((file) => file.id));
            onProgress(stored.length, usable.length);
        }
    } catch (err) {
        if (isSessionEndedError(err)) throw err;
        console.warn('Notation archive not used:', err);
    }

    return stored;
}
