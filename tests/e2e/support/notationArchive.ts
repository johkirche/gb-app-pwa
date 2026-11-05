import { gzipSync } from 'node:zlib';

/*
 * A notation archive built by hand, the way directus-notation-bundle-extension
 * writes one: USTAR headers, gzip around the lot. Shared by the unit spec, which
 * takes it apart on purpose, and the e2e spec, which hands it to real browser
 * engines.
 *
 * Every file in here is synthetic. The book's own engravings are not ours to
 * redistribute and do not belong in a fixture.
 */

const BLOCK_SIZE = 512;

export interface ArchiveFile {
    id: string;
    type: string;
    modifiedOn: string | null;
    content: string | Uint8Array;
}

function toBytes(content: string | Uint8Array): Buffer {
    return typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
}

function octal(value: number, digits: number): string {
    return `${value.toString(8).padStart(digits, '0')}\0`;
}

export function tarHeader(name: string, size: number, typeflag = '0'): Buffer {
    const header = Buffer.alloc(BLOCK_SIZE);
    header.write(name, 0);
    header.write(octal(0o644, 7), 100);
    header.write(octal(0, 7), 108);
    header.write(octal(0, 7), 116);
    header.write(octal(size, 11), 124);
    header.write(octal(0, 11), 136);
    header.write(typeflag, 156);
    header.write('ustar\x0000', 257);
    header.write(octal(0, 7), 329);
    header.write(octal(0, 7), 337);

    // The checksum counts its own field as eight spaces.
    header.write(' '.repeat(8), 148);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
    return header;
}

/** One entry: its header, its bytes, and the padding up to the next block. */
export function tarEntry(name: string, content: string | Uint8Array, typeflag = '0'): Buffer {
    const body = toBytes(content);
    const padding = Buffer.alloc((BLOCK_SIZE - (body.length % BLOCK_SIZE)) % BLOCK_SIZE);
    return Buffer.concat([tarHeader(name, body.length, typeflag), body, padding]);
}

/** tar ends on two zero blocks. */
export const TAR_END = Buffer.alloc(BLOCK_SIZE * 2);

export function indexJson(files: ArchiveFile[]): string {
    return JSON.stringify({
        version: 1,
        generated: '2026-11-03T12:00:00.000Z',
        files: Object.fromEntries(
            files.map(({ id, type, modifiedOn }) => [id, { modifiedOn, type }]),
        ),
    });
}

export function notationTar(files: ArchiveFile[]): Buffer {
    return Buffer.concat([
        tarEntry('index.json', indexJson(files)),
        ...files.map((file) => tarEntry(file.id, file.content)),
        TAR_END,
    ]);
}

export function gzip(bytes: Uint8Array): Buffer {
    return gzipSync(bytes, { level: 9 });
}

export function notationArchive(files: ArchiveFile[]): Buffer {
    return gzip(notationTar(files));
}
