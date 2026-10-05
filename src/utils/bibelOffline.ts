import { BIBEL_BOOKS, type Block } from '@/utils/bibel';

/**
 * The whole Bible on the device, on request.
 *
 * Books are normally kept one at a time, as they are read (bibel-cache in
 * vite.config.ts). A reader who wants the Bible in a place without a signal
 * can fetch all 66 at once. The files go into the very cache the service
 * worker reads from, so the reader and the search find them there without
 * knowing how they got in.
 *
 * Cache Storage is the only record. A remembered "downloaded" flag would
 * outlive a browser that clears the cache under storage pressure; asking the
 * cache costs 66 lookups and is always true.
 */

export const BIBEL_CACHE = 'bibel-cache';

/** What the 66 files weigh on the wire (gzipped), as the reader is told. */
export const BIBEL_DOWNLOAD_SIZE = '1,5 MB';

export function bookFileUrl(slug: string): string {
    return `/bibeltext/menge/${slug}.json`;
}

// Workbox stores entries under the absolute request URL; match and put both
// resolve a relative one against the page, but saying so keeps it obvious.
function cacheKey(slug: string): string {
    return new URL(bookFileUrl(slug), location.origin).href;
}

function cacheStorage(): CacheStorage | null {
    return typeof caches === 'undefined' ? null : caches;
}

/**
 * The books already in the cache, or null where the browser has no Cache
 * Storage (an insecure origin, some private modes): there "offline" cannot be
 * promised, so the question is not asked.
 */
export async function offlineBookSlugs(): Promise<Set<string> | null> {
    const storage = cacheStorage();
    if (!storage) return null;
    try {
        const cache = await storage.open(BIBEL_CACHE);
        const found = await Promise.all(
            BIBEL_BOOKS.map(async (book) =>
                (await cache.match(cacheKey(book.slug))) ? book.slug : null,
            ),
        );
        return new Set(found.filter((slug): slug is string => slug !== null));
    } catch {
        return null;
    }
}

/**
 * One book's chapters, for the search index. Not `loadBook`: that keeps every
 * book it has parsed for the session, which is right for turning pages and
 * wrong for reading all 66 once to index them — the index keeps the text, the
 * parsed blocks can go.
 *
 * When the network fails the cache is asked directly. With a service worker
 * in control that is what the fetch already did; without one (a first visit,
 * development) it is the only way to a book downloaded earlier.
 */
export async function readBookFile(slug: string): Promise<Block[][]> {
    let response: Response | undefined;
    try {
        response = await fetch(bookFileUrl(slug));
        if (!response.ok) response = undefined;
    } catch {
        response = undefined;
    }
    if (!response) {
        const storage = cacheStorage();
        response = storage ? await storage.match(cacheKey(slug)) : undefined;
    }
    if (!response) throw new Error(`${slug}: neither online nor in the cache`);
    const data = (await response.json()) as { chapters: Block[][] };
    return data.chapters;
}

/**
 * Runs `worker` over `items` with at most `limit` at a time. Small on purpose:
 * a phone on a weak connection does better with a few requests in flight than
 * with 66 competing for it.
 */
export async function runPool<T>(
    items: readonly T[],
    limit: number,
    worker: (item: T) => Promise<void>,
): Promise<void> {
    let next = 0;
    const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            await worker(item);
        }
    });
    await Promise.all(lanes);
}

export interface DownloadProgress {
    /** Books on the device, those that were there before included. */
    available: number;
    total: number;
}

export interface DownloadResult extends DownloadProgress {
    /** The books that could not be fetched — usually the connection dropped. */
    failed: string[];
}

/**
 * Fetches every book not yet in the cache and puts it there. A book that
 * fails is counted and skipped rather than ending the run: going offline
 * halfway should leave the reader with the half that arrived, and an honest
 * count of it.
 */
export async function downloadBible(
    onProgress?: (progress: DownloadProgress) => void,
    concurrency = 3,
): Promise<DownloadResult> {
    const total = BIBEL_BOOKS.length;
    const storage = cacheStorage();
    if (!storage) {
        return { available: 0, total, failed: BIBEL_BOOKS.map((book) => book.slug) };
    }

    const cache = await storage.open(BIBEL_CACHE);
    const have = (await offlineBookSlugs()) ?? new Set<string>();
    const todo = BIBEL_BOOKS.filter((book) => !have.has(book.slug));
    const failed: string[] = [];
    let available = have.size;
    onProgress?.({ available, total });

    await runPool(todo, concurrency, async (book) => {
        try {
            const response = await fetch(bookFileUrl(book.slug));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            // Put it in ourselves rather than trusting the service worker to:
            // on a first visit, or in development, no worker controls the
            // page and the fetch alone would keep nothing.
            await cache.put(cacheKey(book.slug), response);
            available++;
        } catch {
            failed.push(book.slug);
        }
        onProgress?.({ available, total });
    });

    return { available, total, failed };
}
