import { type Page, expect, test } from '@playwright/test';

import {
    type ArchiveFile,
    TAR_END,
    gzip,
    notationArchive,
    tarEntry,
} from './support/notationArchive';

/*
 * The notation archive, read by the engines that will have to read it.
 *
 * The unit spec runs on Node's streams, which say nothing about a browser's. What
 * the reader leans on here is per engine — DecompressionStream, Blob.stream, the
 * type a Blob ends up with — and iOS only has WebKit's. So this imports the reader
 * into a real page and hands it a small archive built in Node.
 *
 * No backend and no recording: nothing but the dev server has to answer, and a
 * request that tried to leave it would fail the test.
 */

// The worker answers below the level page.route sees, so it has to be out of the
// way for "nothing left the origin" to mean anything.
test.use({ serviceWorkers: 'block' });

const READER = '/src/utils/notationBundle.ts';
const BLANK_PAGE = '/notation-bundle-blank';

const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><title>Größe</title></svg>';
const SVG_TYPE = 'image/svg+xml';
const MXML_TYPE = 'application/vnd.recordare.musicxml';
const STAMP = '2026-08-18T13:00:00.000Z';

/** Every byte value, over more than a block: nothing here may be read as text. */
const BINARY = Array.from({ length: 1400 }, (_, i) => i % 256);

/**
 * Incompressible, so the engine's inflate has to hand it over in several chunks
 * and the reader sees an entry cut across them. A plain counter generator, so a
 * failure reproduces.
 */
const LONG = (() => {
    let state = 1;
    return Array.from({ length: 150_000 }, () => {
        state = (state * 48271) % 2147483647;
        return state % 256;
    });
})();

const FILES: ArchiveFile[] = [
    { id: 'svg-1', type: SVG_TYPE, modifiedOn: STAMP, content: SVG },
    { id: 'mxml-1', type: MXML_TYPE, modifiedOn: null, content: new Uint8Array(BINARY) },
    { id: 'long-1', type: MXML_TYPE, modifiedOn: STAMP, content: new Uint8Array(LONG) },
    { id: 'empty-1', type: SVG_TYPE, modifiedOn: STAMP, content: '' },
];

interface ReadResult {
    version: number;
    files: { id: string; type: string; modifiedOn: string | null; bytes: number[] }[];
}

type Reader = typeof import('@/utils/notationBundle');

/** The reader, run in the page. Rejections come back as their message. */
function readInPage(page: Page, archive: Uint8Array, chunkSize?: number) {
    return page.evaluate(
        async ({ reader, bytes, chunkSize }): Promise<ReadResult | { error: string }> => {
            const { readNotationBundle } = (await import(/* @vite-ignore */ reader)) as Reader;
            const data = new Uint8Array(bytes);

            let source: Blob | ReadableStream<Uint8Array<ArrayBuffer>> = new Blob([data]);
            if (chunkSize) {
                let at = 0;
                source = new ReadableStream({
                    pull(controller) {
                        if (at >= data.length) return controller.close();
                        controller.enqueue(data.slice(at, at + chunkSize));
                        at += chunkSize;
                    },
                });
            }

            try {
                const { index, files } = await readNotationBundle(source);
                return {
                    version: index.version,
                    files: await Promise.all(
                        files.map(async ({ id, blob, modifiedOn }) => ({
                            id,
                            type: blob.type,
                            modifiedOn,
                            bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
                        })),
                    ),
                };
            } catch (err) {
                return { error: err instanceof Error ? err.message : String(err) };
            }
        },
        { reader: READER, bytes: Array.from(archive), chunkSize },
    );
}

function expectRead(result: ReadResult | { error: string }): ReadResult {
    if ('error' in result) throw new Error(`The reader refused the archive: ${result.error}`);
    return result;
}

function contentBytes({ content }: ArchiveFile): number[] {
    return typeof content === 'string'
        ? Array.from(Buffer.from(content, 'utf8'))
        : Array.from(content);
}

let asked: string[] = [];

test.beforeEach(async ({ page, request }) => {
    // First, or a failure below leaves afterEach to read the last test's list.
    asked = [];

    // Playwright reuses whatever already answers on the port, and that can be the
    // dev server of another checkout. The app's fallback answers a path it does not
    // have with its HTML, which the import below would report as nothing more than
    // a failed module.
    const served = await request.get(READER);
    expect(
        served.headers()['content-type'],
        `The dev server does not serve ${READER}: is it another checkout's?`,
    ).toContain('javascript');

    // The backend cut off: whatever leaves the app's own origin fails, and says so.
    // Over http only, because a blob: URL has no hostname and WebKit routes it too.
    await page.route(
        (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost',
        (route) => {
            asked.push(route.request().url());
            return route.abort();
        },
    );

    // An empty page on the app's origin is all a same-origin import needs. The app
    // would only add its whole module graph to wait for, and on a cold dev server
    // that is enough to time a page load out.
    await page.route(`**${BLANK_PAGE}`, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Leer</title>' }),
    );
    await page.goto(BLANK_PAGE);
});

test.afterEach(() => {
    expect(asked, 'reading an archive reached off-origin').toEqual([]);
});

test('reads every file with its type and its exact bytes', async ({ page }) => {
    const { version, files } = expectRead(await readInPage(page, notationArchive(FILES)));

    expect(version).toBe(1);
    expect(files.map((file) => file.id)).toEqual(FILES.map((file) => file.id));
    for (const [i, file] of files.entries()) {
        expect(file.type, file.id).toBe(FILES[i].type);
        expect(file.modifiedOn, file.id).toBe(FILES[i].modifiedOn);
        expect(file.bytes.length, file.id).toBe(contentBytes(FILES[i]).length);
        expect(file.bytes, file.id).toEqual(contentBytes(FILES[i]));
    }
});

test('reads a stream cut into small pieces', async ({ page }) => {
    const small = FILES.filter((file) => file.id !== 'long-1');
    const { files } = expectRead(await readInPage(page, notationArchive(small), 16));

    expect(files.map((file) => file.bytes)).toEqual(small.map(contentBytes));
});

test('hands back an SVG the browser will actually show', async ({ page }) => {
    // The whole reason the index carries a type: the app draws a Notenbild through
    // an object URL, and an untyped Blob there is a broken image.
    const size = await page.evaluate(
        async ({ reader, bytes }) => {
            const { readNotationBundle } = (await import(/* @vite-ignore */ reader)) as Reader;
            const { files } = await readNotationBundle(new Blob([new Uint8Array(bytes)]));
            const svg = files.find((file) => file.id === 'svg-1')!;

            const image = new Image();
            const url = URL.createObjectURL(svg.blob);
            try {
                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = () => reject(new Error('The SVG did not load'));
                    image.src = url;
                });
            } finally {
                URL.revokeObjectURL(url);
            }
            return { width: image.naturalWidth, height: image.naturalHeight };
        },
        { reader: READER, bytes: Array.from(notationArchive(FILES)) },
    );

    expect(size).toEqual({ width: 40, height: 20 });
});

test('rejects an archive cut off in the middle', async ({ page }) => {
    const archive = notationArchive(FILES);
    const result = await readInPage(page, archive.subarray(0, Math.floor(archive.length / 2)));

    expect(result).toHaveProperty('error');
});

test('rejects an archive that lost only its gzip trailer', async ({ page }) => {
    // What "nothing reaches IndexedDB before the CRC has been checked" rests on. The
    // tar inside is whole and arrives whole, so only the engine's inflate can notice
    // that the checksum it was to be held against never came, and it says so at the
    // very end of the stream: a reader that stopped at the end block would never hear.
    const archive = notationArchive(FILES);

    expect(await readInPage(page, archive.subarray(0, archive.length - 8))).toHaveProperty('error');
});

test('rejects a tar with no end-of-archive block, though its gzip is whole', async ({ page }) => {
    // A cut that gzip cannot see: this one only the tar reader can refuse.
    const index = JSON.stringify({ version: 1, generated: STAMP, files: {} });
    const result = await readInPage(page, gzip(tarEntry('index.json', index)));

    expect(result).toEqual({ error: expect.stringMatching(/truncated/) });
});

test('accepts the same tar once it has its end-of-archive block', async ({ page }) => {
    // The other half of the test above, so that one cannot pass for another reason.
    const index = JSON.stringify({ version: 1, generated: STAMP, files: {} });
    const result = await readInPage(
        page,
        gzip(Buffer.concat([tarEntry('index.json', index), TAR_END])),
    );

    expect(expectRead(result).files).toEqual([]);
});

test('rejects bytes whose gzip checksum does not match', async ({ page }) => {
    // The tar inside is flawless, so only the engine's inflate can catch this.
    const archive = Buffer.from(notationArchive(FILES));
    archive[archive.length - 8] ^= 0xff;

    expect(await readInPage(page, archive)).toHaveProperty('error');
});
