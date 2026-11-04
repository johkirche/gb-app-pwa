// @vitest-environment node
// jsdom's Blob has no stream(), and the stream is the whole point here.
import { describe, expect, it, vi } from 'vitest';

import {
    type ArchiveFile,
    TAR_END,
    gzip,
    indexJson,
    notationArchive,
    notationTar,
    tarEntry,
    tarHeader,
} from '../../tests/e2e/support/notationArchive';
import { parseNotationTar, readNotationBundle, sameFileStamp } from './notationBundle';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><title>Großer Gott</title></svg>';
const SVG_TYPE = 'image/svg+xml';
const MXML_TYPE = 'application/vnd.recordare.musicxml';
const STAMP = '2026-08-18T13:00:00.000Z';

const FILES: ArchiveFile[] = [
    { id: 'svg-1', type: SVG_TYPE, modifiedOn: STAMP, content: SVG },
    // Longer than a block, so the entry runs across a block boundary.
    { id: 'mxml-1', type: MXML_TYPE, modifiedOn: null, content: new Uint8Array(1300).fill(7) },
    // Exactly a block, so no padding follows it.
    { id: 'svg-2', type: SVG_TYPE, modifiedOn: STAMP, content: 'x'.repeat(512) },
    { id: 'empty', type: SVG_TYPE, modifiedOn: STAMP, content: '' },
];

/** A stream that cuts the bytes into pieces of this size. */
function chunked(bytes: Uint8Array, size: number): ReadableStream<Uint8Array<ArrayBuffer>> {
    let at = 0;
    return new ReadableStream({
        pull(controller) {
            if (at >= bytes.length) {
                controller.close();
                return;
            }
            controller.enqueue(new Uint8Array(bytes.subarray(at, at + size)));
            at += size;
        },
    });
}

function blobOf(bytes: Uint8Array): Blob {
    return new Blob([new Uint8Array(bytes)]);
}

/** A header edited by hand, its checksum made right again: the edit is what gets refused. */
function resummed(header: Buffer): Buffer {
    header.write(' '.repeat(8), 148);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
    return header;
}

async function expectRoundTrip(
    files: Awaited<ReturnType<typeof readNotationBundle>>['files'],
    sources = FILES,
) {
    expect(files.map((file) => file.id)).toEqual(sources.map((file) => file.id));

    for (const [i, file] of files.entries()) {
        const source = sources[i];
        const expected =
            typeof source.content === 'string'
                ? new TextEncoder().encode(source.content)
                : source.content;

        expect(file.blob.type).toBe(source.type);
        expect(file.modifiedOn).toBe(source.modifiedOn);
        expect(new Uint8Array(await file.blob.arrayBuffer())).toEqual(expected);
    }
}

describe('readNotationBundle', () => {
    it('hands back every file with its type, its stamp and its exact bytes', async () => {
        const { index, files } = await readNotationBundle(blobOf(notationArchive(FILES)));

        expect(index.version).toBe(1);
        expect(index.files['svg-1']).toEqual({ modifiedOn: STAMP, type: SVG_TYPE });
        await expectRoundTrip(files);
    });

    it('keeps a zero-size file', async () => {
        const { files } = await readNotationBundle(blobOf(notationArchive(FILES)));

        const empty = files.find((file) => file.id === 'empty');
        expect(empty?.blob.size).toBe(0);
        expect(empty?.blob.type).toBe(SVG_TYPE);
    });

    it('reads an archive that lists no files at all', async () => {
        const { files } = await readNotationBundle(blobOf(notationArchive([])));
        expect(files).toEqual([]);
    });

    it('reads a stream as well as a Blob, however the gzip bytes are cut', async () => {
        const { files } = await readNotationBundle(chunked(notationArchive(FILES), 1));
        await expectRoundTrip(files);
    });
});

describe('parseNotationTar chunking', () => {
    // 511 and 513 are the two that leave a header split across a chunk boundary
    // at every block; 1 leaves every field of every header split.
    it.each([1, 2, 7, 100, 511, 512, 513, 4096])('copes with chunks of %i bytes', async (size) => {
        const { files } = await parseNotationTar(chunked(notationTar(FILES), size));
        await expectRoundTrip(files);
    });

    it('reads an index with a character cut in two by a chunk', async () => {
        const index = JSON.stringify({ version: 1, generated: 'Größe', files: {} });
        const tar = Buffer.concat([tarEntry('index.json', index), TAR_END]);

        const read = await parseNotationTar(chunked(tar, 1));

        expect(read.index.generated).toBe('Größe');
    });
});

describe('parseNotationTar and the stream under it', () => {
    type Controller = ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>;

    it('reads on past the end block, because the gzip checksum is checked after it', async () => {
        // A flawless tar, and then the stream fails: what inflate does when the
        // trailer does not match. Stop at the end block and this reads as a success,
        // and a corrupt archive goes into IndexedDB.
        const steps = [
            (controller: Controller) => controller.enqueue(new Uint8Array(notationTar(FILES))),
            (controller: Controller) => controller.error(new Error('checksum')),
        ];
        const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull: (controller) => steps.shift()?.(controller),
        });

        await expect(parseNotationTar(stream)).rejects.toThrow('checksum');
    });

    it('cancels the stream when the bytes are refused, or it would run on to its end', async () => {
        const cancel = vi.fn();
        const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
            pull: (controller) =>
                controller.enqueue(new Uint8Array(tarEntry('not-the-index', SVG))),
            cancel,
        });

        await expect(parseNotationTar(stream)).rejects.toThrow(/first entry/);
        expect(cancel).toHaveBeenCalledOnce();
    });
});

describe('what the archive refuses', () => {
    const tarOf = (...parts: Buffer[]) => blobOf(gzip(Buffer.concat(parts)));
    const INDEX = tarEntry('index.json', indexJson(FILES.slice(0, 1)));
    const ENTRY = tarEntry('svg-1', SVG);

    it('accepts the well-formed baseline these all break', async () => {
        await expect(readNotationBundle(tarOf(INDEX, ENTRY, TAR_END))).resolves.toBeTruthy();
    });

    it('a version it does not know', async () => {
        const index = tarEntry('index.json', JSON.stringify({ version: 2, files: {} }));
        await expect(readNotationBundle(tarOf(index, TAR_END))).rejects.toThrow(/version 2/);
    });

    it('a first entry that is not index.json', async () => {
        await expect(readNotationBundle(tarOf(ENTRY, INDEX, TAR_END))).rejects.toThrow(
            /first entry/,
        );
    });

    it('an archive with no entries', async () => {
        await expect(readNotationBundle(tarOf(TAR_END))).rejects.toThrow(/first entry/);
    });

    it('an index that does not parse', async () => {
        const index = tarEntry('index.json', '{ not json');
        await expect(readNotationBundle(tarOf(index, TAR_END))).rejects.toThrow(SyntaxError);
    });

    it('an index that is not UTF-8', async () => {
        // Inside a string, where a lenient decoder would hand JSON.parse a U+FFFD
        // and nobody would be any the wiser.
        const index = tarEntry(
            'index.json',
            Buffer.concat([
                Buffer.from('{"version":1,"generated":"'),
                Buffer.from([0xff]),
                Buffer.from('","files":{}}'),
            ]),
        );
        await expect(readNotationBundle(tarOf(index, TAR_END))).rejects.toThrow(TypeError);
    });

    it.each([
        ['no files', { version: 1, generated: STAMP }, /lists no files/],
        ['files as an array', { version: 1, generated: STAMP, files: [] }, /lists no files/],
        ['no generation time', { version: 1, files: {} }, /no generation time/],
        ['null', null, /unsupported version/],
    ])('an index with %s', async (_name, index, message) => {
        const entry = tarEntry('index.json', JSON.stringify(index));
        await expect(readNotationBundle(tarOf(entry, TAR_END))).rejects.toThrow(message);
    });

    describe('an index whose entry for a file', () => {
        // The file is there, so the only thing wrong with the archive is the entry
        // itself: a listed file with no tar entry is refused too, by a later check.
        const withEntry = (listed: unknown) =>
            tarOf(
                tarEntry(
                    'index.json',
                    JSON.stringify({ version: 1, generated: STAMP, files: { a: listed } }),
                ),
                tarEntry('a', SVG),
                TAR_END,
            );

        it('accepts the well-formed one these all break', async () => {
            const { files } = await readNotationBundle(
                withEntry({ modifiedOn: null, type: SVG_TYPE }),
            );
            expect(files.map((file) => file.id)).toEqual(['a']);
        });

        it.each([
            ['has no type', { modifiedOn: null }],
            ['has an empty type', { modifiedOn: null, type: '' }],
            ['has a type that is no string', { modifiedOn: null, type: 7 }],
            ['has no stamp', { type: SVG_TYPE }],
            ['has a stamp that is no string', { modifiedOn: 7, type: SVG_TYPE }],
            ['is null', null],
        ])('%s', async (_name, listed) => {
            await expect(readNotationBundle(withEntry(listed))).rejects.toThrow(/malformed/);
        });
    });

    it.each([
        ['a directory', '5'],
        ['a hard link', '1'],
        ['a symlink', '2'],
        ['a PAX header', 'x'],
        ['the pre-POSIX spelling of a regular file', '\0'],
    ])('%s among the entries', async (_name, typeflag) => {
        const odd = tarEntry('svg-1', SVG, typeflag);
        await expect(readNotationBundle(tarOf(INDEX, odd, TAR_END))).rejects.toThrow(
            /not a regular file/,
        );
    });

    it('a stream that stops without the end-of-archive block', async () => {
        await expect(readNotationBundle(tarOf(INDEX, ENTRY))).rejects.toThrow(/truncated/);
    });

    it('a stream that stops inside an entry', async () => {
        const cut = ENTRY.subarray(0, 512 + 10);
        await expect(readNotationBundle(tarOf(INDEX, cut))).rejects.toThrow(/truncated/);
    });

    it('a stream that stops inside a header', async () => {
        const cut = ENTRY.subarray(0, 100);
        await expect(readNotationBundle(tarOf(INDEX, cut))).rejects.toThrow(/truncated/);
    });

    it('a stream that stops inside the padding', async () => {
        const cut = ENTRY.subarray(0, 512 + SVG.length + 1);
        await expect(readNotationBundle(tarOf(INDEX, cut))).rejects.toThrow(/truncated/);
    });

    it('a gzip stream cut short', async () => {
        const archive = notationArchive(FILES);
        const cut = archive.subarray(0, archive.length - 20);
        await expect(readNotationBundle(blobOf(cut))).rejects.toThrow();
    });

    it('a gzip stream whose checksum does not match', async () => {
        const archive = Buffer.from(notationArchive(FILES));
        // The CRC is the eight-byte trailer's first half.
        archive[archive.length - 8] ^= 0xff;
        await expect(readNotationBundle(blobOf(archive))).rejects.toThrow();
    });

    it('bytes that are not gzip at all', async () => {
        await expect(readNotationBundle(blobOf(notationTar(FILES)))).rejects.toThrow();
    });

    it('an entry the index does not list', async () => {
        const extra = tarEntry('svg-unlisted', SVG);
        await expect(readNotationBundle(tarOf(INDEX, ENTRY, extra, TAR_END))).rejects.toThrow(
            /unlisted/,
        );
    });

    it('a name that only exists on Object.prototype', async () => {
        const extra = tarEntry('constructor', SVG);
        await expect(readNotationBundle(tarOf(INDEX, ENTRY, extra, TAR_END))).rejects.toThrow(
            /unlisted/,
        );
    });

    it('a listed file with no entry', async () => {
        const index = tarEntry('index.json', indexJson(FILES));
        await expect(readNotationBundle(tarOf(index, ENTRY, TAR_END))).rejects.toThrow(
            /have no entry/,
        );
    });

    it('a file that appears twice', async () => {
        await expect(readNotationBundle(tarOf(INDEX, ENTRY, ENTRY, TAR_END))).rejects.toThrow(
            /appears twice/,
        );
    });

    it('data hidden after the end-of-archive block', async () => {
        const extra = tarEntry('svg-hidden', SVG);
        await expect(readNotationBundle(tarOf(INDEX, ENTRY, TAR_END, extra))).rejects.toThrow(
            /after the end-of-archive/,
        );
    });

    it('a header that fails its checksum', async () => {
        const damaged = Buffer.from(ENTRY);
        damaged[0] ^= 0x01;
        await expect(readNotationBundle(tarOf(INDEX, damaged, TAR_END))).rejects.toThrow(
            /checksum/,
        );
    });

    it.each([
        ['that is not an octal number', 'zzzzzzzzzzz\0'],
        ['that only starts with one', '0000000012x\0'],
        ['padded with spaces', '         12\0'],
    ])('a size %s', async (_name, size) => {
        const header = tarHeader('svg-1', 0);
        header.write(size, 124);

        await expect(readNotationBundle(tarOf(INDEX, resummed(header), TAR_END))).rejects.toThrow(
            /bad number/,
        );
    });

    it('a name that goes on in the prefix field', async () => {
        const header = tarHeader('svg-1', 0);
        header.write('elsewhere', 345);

        await expect(readNotationBundle(tarOf(INDEX, resummed(header), TAR_END))).rejects.toThrow(
            /path prefix/,
        );
    });

    it('an end-of-archive block that only starts with a zero', async () => {
        // A header with an empty name is not the end of anything, however much it
        // looks like it from the first byte.
        await expect(
            readNotationBundle(tarOf(INDEX, ENTRY, tarHeader('', 0), TAR_END)),
        ).rejects.toThrow(/unlisted/);
    });

    it('reads past the two zero blocks when only padding follows them', async () => {
        const padded = tarOf(INDEX, ENTRY, TAR_END, Buffer.alloc(9216));
        await expect(readNotationBundle(padded)).resolves.toBeTruthy();
    });
});

/*
 * What gb-scripts really writes. Everything above reads archives from this repo's
 * own helper, which shows the reader agrees with the helper and nothing about the
 * writer. This one came out of build_archive() in gb-scripts'
 * app/36-build-notation-bundle.py, from the invented files in the recipe below.
 *
 * It is a snapshot, so it holds the reader to the writer as of the last time it
 * was made. When build_archive changes, run this from gb-scripts' root and paste
 * what it prints over BUILDER_ARCHIVE:
 *
 *     PYTHONPATH=. .venv/Scripts/python.exe - <<'EOF'
 *     import base64, importlib.util, sys
 *     spec = importlib.util.spec_from_file_location("b", "app/36-build-notation-bundle.py")
 *     b = importlib.util.module_from_spec(spec)
 *     sys.modules["b"] = b
 *     spec.loader.exec_module(b)
 *     F, SVG, MXL = b.NotationFile, "image/svg+xml", "application/vnd.recordare.musicxml"
 *     STAMP, ID = "2026-08-18T13:00:00.000Z", "00000000-0000-4000-8000-00000000000"
 *     TEXT = '<svg xmlns="http://www.w3.org/2000/svg"><title>Größe</title></svg>'
 *     print(base64.b64encode(b.build_archive({
 *         ID + "1": F(STAMP, SVG, TEXT.encode()),
 *         ID + "2": F(None, MXL, bytes(i % 256 for i in range(1300))),
 *         ID + "3": F(STAMP, SVG, b"x" * 512),
 *         ID + "4": F(STAMP, SVG, b""),
 *     }, "2026-11-03T12:00:00+00:00")).decode())
 *     EOF
 */
describe('the archive gb-scripts writes', () => {
    const BUILDER_ARCHIVE = [
        'H4sIAAAAAAACCsvMS0mt0Msqzs9joBkwAAIzExMwDQTotIG5sRmcDRE3Nzc1ZVAwYKADKC0uSSwCWskwMkG1',
        'UllqUXFmfp6SlaGOUnpqXmpRYklqipKVkpGBkZmuoaGugXGIoZGVgQEQaYNJJR2ltMyc1GIlq2olWJzpggkT',
        'EGEB40KBIUhdbn5KZlpmaop/HsxkAwtdQ4sQQ2OIyXpAhVFAg0sqC1KBKjJzE9NT9YvL0rUrcnOUanWIsccI',
        '3Z680pwcuImJBQU5mcmJJUCf6pflpegVpSbnF6UkFqXq5ZYWZyYTb40xnbxjQrk9tbXE5U1CEUjr/G9oYIKa',
        '/w0NjUyMR/M/PYANMLUoAFNLXrGtUkZJSYGVvn55ebleubFeflG6vhEwOkDpScnOpiSzJCfVzr3o8LbD81Nt',
        '9CFcG5CkHcMoGLKAmIKVxvnfyMQIM/+bjuZ/+gBGJmYWVjZ2Dk4ubh5ePn4BQSFhEVExcQlJKWkZWTl5BUUl',
        'ZRVVNXUNTS1tHV09fQNDI2MTUzNzC0sraxtbO3sHRydnF1c3dw9PL28fXz//gMCg4JDQsPCIyKjomNi4+ITE',
        'pOSU1LT0jMys7JzcvPyCwqLiktKy8orKquqa2rr6hsam5pbWtvaOzq7unt6+/gkTJ02eMnXa9BkzZ82eM3fe',
        '/AULFy1esnTZ8hUrV61es3bd+g0bN23esnXb9h07d+3es3ff/gMHDx0+cvTY8RMnT50+c/bc+QsXL12+cvXa',
        '9Rs3b92+c/fe/QcPHz1+8vTZ8xcvX71+8/bd+w8fP33+8vXb9x8/f/3+8/ff/1H/j/p/1P+j/kf2/2j9j9rj',
        'oXH9b4jcF4C3/w1H6396gIpRMKIBMSMRtO7/j+b/UTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMApoAwAh',
        'eKEQACgAAA==',
    ].join('');

    const ID = '00000000-0000-4000-8000-00000000000';
    const WRITTEN: ArchiveFile[] = [
        {
            id: `${ID}1`,
            type: SVG_TYPE,
            modifiedOn: STAMP,
            content: '<svg xmlns="http://www.w3.org/2000/svg"><title>Größe</title></svg>',
        },
        // Runs across a block boundary and holds every byte value.
        {
            id: `${ID}2`,
            type: MXML_TYPE,
            modifiedOn: null,
            content: Uint8Array.from({ length: 1300 }, (_, i) => i % 256),
        },
        // Exactly a block, so no padding follows it.
        { id: `${ID}3`, type: SVG_TYPE, modifiedOn: STAMP, content: 'x'.repeat(512) },
        { id: `${ID}4`, type: SVG_TYPE, modifiedOn: STAMP, content: '' },
    ];

    it('reads a fixture built by the real builder, from synthetic files', async () => {
        const archive = Buffer.from(BUILDER_ARCHIVE, 'base64');
        const { index, files } = await readNotationBundle(blobOf(archive));

        expect(index.version).toBe(1);
        expect(index.generated).toBe('2026-11-03T12:00:00+00:00');
        expect(Object.keys(index.files)).toEqual(WRITTEN.map((file) => file.id));
        await expectRoundTrip(files, WRITTEN);
    });
});

describe('sameFileStamp', () => {
    it('agrees when both say nothing', () => {
        expect(sameFileStamp(null, null)).toBe(true);
    });

    it('agrees on one instant, however it is written', () => {
        expect(sameFileStamp('2026-08-18T13:00:00.000Z', '2026-08-18T13:00:00.000Z')).toBe(true);
        expect(sameFileStamp('2026-08-18T13:00:00.000Z', '2026-08-18T13:00:00Z')).toBe(true);
        expect(sameFileStamp('2026-08-18T13:00:00Z', '2026-08-18T15:00:00+02:00')).toBe(true);
    });

    it('tells two instants apart', () => {
        expect(sameFileStamp('2026-08-18T13:00:00.000Z', '2026-08-18T13:00:00.001Z')).toBe(false);
    });

    it('does not let a stamp on one side stand in for none on the other', () => {
        expect(sameFileStamp(STAMP, null)).toBe(false);
        expect(sameFileStamp(null, STAMP)).toBe(false);
    });

    it('trusts nothing that does not parse, not even the same string', () => {
        expect(sameFileStamp('gestern', STAMP)).toBe(false);
        expect(sameFileStamp(STAMP, 'gestern')).toBe(false);
        expect(sameFileStamp('gestern', 'gestern')).toBe(false);
    });
});
