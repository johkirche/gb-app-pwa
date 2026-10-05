import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BIBEL_BOOKS } from './bibel';
import { downloadBible, offlineBookSlugs, readBookFile, runPool } from './bibelOffline';

// A Cache Storage with one cache, enough for what the module asks of it.
function fakeCaches(initial: string[] = []) {
    const store = new Map<string, Response>();
    for (const slug of initial) {
        store.set(`http://localhost:3000/bibeltext/menge/${slug}.json`, new Response('{}'));
    }
    const cache = {
        match: vi.fn(async (key: string) => store.get(key)?.clone()),
        put: vi.fn(async (key: string, response: Response) => void store.set(key, response)),
    };
    return {
        store,
        storage: {
            open: vi.fn(async () => cache),
            match: vi.fn(async (key: string) => store.get(key)?.clone()),
        },
    };
}

function slugOf(url: string): string {
    return url.replace(/^.*\//, '').replace(/\.json$/, '');
}

beforeEach(() => {
    vi.stubGlobal('location', new URL('http://localhost:3000/tabs/bibel'));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('runPool', () => {
    it('works through every item, never more than the limit at once', async () => {
        let running = 0;
        let peak = 0;
        const done: number[] = [];
        await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
            running++;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 1));
            done.push(n);
            running--;
        });
        expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(peak).toBe(3);
    });

    it('copes with nothing to do', async () => {
        await expect(runPool([], 3, async () => {})).resolves.toBeUndefined();
    });
});

describe('offlineBookSlugs', () => {
    it('lists the books in the cache', async () => {
        vi.stubGlobal('caches', fakeCaches(['psalm', 'johannes']).storage);
        expect(await offlineBookSlugs()).toEqual(new Set(['psalm', 'johannes']));
    });

    it('answers null where there is no Cache Storage', async () => {
        vi.stubGlobal('caches', undefined);
        expect(await offlineBookSlugs()).toBeNull();
    });
});

describe('downloadBible', () => {
    it('fetches only the missing books and reports progress up to all 66', async () => {
        const { storage, store } = fakeCaches(['psalm']);
        vi.stubGlobal('caches', storage);
        const fetchMock = vi.fn(async () => new Response('{"chapters":[]}'));
        vi.stubGlobal('fetch', fetchMock);

        const seen: number[] = [];
        const result = await downloadBible((p) => seen.push(p.available));

        expect(fetchMock).toHaveBeenCalledTimes(65);
        expect(result).toEqual({ available: 66, total: 66, failed: [] });
        expect(store.size).toBe(66);
        expect(seen[0]).toBe(1);
        expect(seen.at(-1)).toBe(66);
    });

    it('keeps what arrived when the connection drops, and says what did not', async () => {
        vi.stubGlobal('caches', fakeCaches().storage);
        // Online for the Old Testament, offline from Matthew on.
        const nt = new Set(BIBEL_BOOKS.filter((b) => b.testament === 'NT').map((b) => b.slug));
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                if (nt.has(slugOf(url))) throw new TypeError('Failed to fetch');
                return new Response('{"chapters":[]}');
            }),
        );

        const result = await downloadBible(undefined, 4);
        expect(result.available).toBe(39);
        expect(result.failed.sort()).toEqual([...nt].sort());
        expect(await offlineBookSlugs()).toHaveProperty('size', 39);
    });

    it('does not count a server error as a book on the device', async () => {
        vi.stubGlobal('caches', fakeCaches().storage);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('', { status: 503 })),
        );
        const result = await downloadBible();
        expect(result.available).toBe(0);
        expect(result.failed).toHaveLength(66);
    });
});

describe('readBookFile', () => {
    it('falls back to the cache when the network is gone', async () => {
        const { storage, store } = fakeCaches();
        store.set(
            'http://localhost:3000/bibeltext/menge/judas.json',
            new Response('{"chapters":[[{"h":3,"t":"Gruß"}]]}'),
        );
        vi.stubGlobal('caches', storage);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Promise.reject(new TypeError('offline'))),
        );

        expect(await readBookFile('judas')).toEqual([[{ h: 3, t: 'Gruß' }]]);
        await expect(readBookFile('rut')).rejects.toThrow();
    });
});
