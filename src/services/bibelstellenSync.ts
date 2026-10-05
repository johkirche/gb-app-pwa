import { fetchFile, findFileByName } from '@/api/files.api';
import { db } from '@/db';
import {
    BIBELSTELLEN_META_KEY,
    isBibelstellenData,
    reloadBibelstellen,
} from '@/utils/bibelstellen';

/**
 * The Bibelstellen file in Directus, brought onto the device with the songs.
 *
 * Its name is the contract with gb-scripts, which builds and uploads it. A
 * file that is not in the library means the hymnal offers no Bibelstellen,
 * and what an earlier sync stored goes too; a library that cannot be asked
 * (offline, no access) leaves the device as it is.
 */
export const BIBELSTELLEN_FILENAME = 'gesangbuch-bibelstellen.json';

const STAMP_KEY = 'bibelstellen.stamp';

export async function syncBibelstellen(): Promise<void> {
    const info = await findFileByName(BIBELSTELLEN_FILENAME);

    if (!info) {
        const stored = await db.meta.get(BIBELSTELLEN_META_KEY);
        if (stored) {
            await db.meta.bulkDelete([BIBELSTELLEN_META_KEY, STAMP_KEY]);
            await reloadBibelstellen();
        }
        return;
    }

    // Unchanged since the last sync: nothing to fetch.
    const stamp = `${info.id}@${info.modifiedOn ?? ''}`;
    if ((await db.meta.get(STAMP_KEY))?.value === stamp) return;

    const parsed: unknown = JSON.parse(await (await fetchFile(info.id)).text());
    if (!isBibelstellenData(parsed)) {
        throw new Error(`${BIBELSTELLEN_FILENAME} is not in the expected shape`);
    }
    await db.transaction('rw', db.meta, async () => {
        await db.meta.put({ key: BIBELSTELLEN_META_KEY, value: JSON.stringify(parsed) });
        await db.meta.put({ key: STAMP_KEY, value: stamp });
    });
    await reloadBibelstellen();
}
