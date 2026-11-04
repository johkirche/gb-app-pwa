/**
 * The notation archive: every notation file of the book in one gzip stream.
 *
 * gb-scripts builds it and uploads it to the Directus file library, and the
 * bytes are the contract between the two repositories: a single-member gzip
 * stream of a USTAR tar whose first entry is `index.json`, followed by one
 * regular file per notation file, named by its Directus file id and holding
 * exactly what GET /assets/<id> would have answered.
 *
 * Anything else throws. The archive is only an accelerator, so a reader that
 * guessed at a damaged one would trade a slower sync for wrong notes; the
 * caller falls back to fetching file by file instead.
 *
 * Pure and without an app import, so that a browser can load this file alone
 * and test it against its own DecompressionStream (see
 * tests/e2e/notation-bundle.spec.ts).
 */

/** What the index says about one file in the archive. */
export interface NotationBundleEntry {
    /** directus_files.modified_on when the build read it, before the bytes. */
    modifiedOn: string | null;
    /** directus_files.type: an SVG without it will not show through an object URL. */
    type: string;
}

export interface NotationBundleIndex {
    version: 1;
    generated: string;
    files: Record<string, NotationBundleEntry>;
}

export interface NotationBundleFile {
    id: string;
    blob: Blob;
    modifiedOn: string | null;
}

export interface NotationBundle {
    index: NotationBundleIndex;
    files: NotationBundleFile[];
}

const BLOCK_SIZE = 512;
const INDEX_ENTRY_NAME = 'index.json';
const SUPPORTED_VERSION = 1;

// The fields of a USTAR header this reader looks at, as [start, end).
const NAME = [0, 100] as const;
const SIZE = [124, 136] as const;
const CHECKSUM = [148, 156] as const;
const TYPEFLAG = 156;
const PREFIX = [345, 500] as const;

const REGULAR_FILE = 0x30; // '0'

/** The text of a NUL-terminated header field. */
function readText(header: Uint8Array, [start, end]: readonly [number, number]): string {
    const field = header.subarray(start, end);
    const nul = field.indexOf(0);
    return new TextDecoder().decode(nul === -1 ? field : field.subarray(0, nul));
}

/**
 * An octal header field. Strict on purpose: the base-256 form tar uses for huge
 * values has no place in a USTAR archive of engravings, and parseInt would read
 * a garbled field as whatever digits happen to start it.
 */
function readOctal(header: Uint8Array, field: readonly [number, number]): number {
    const text = readText(header, field);
    if (!/^[0-7]+$/.test(text)) {
        throw new Error(`Notation archive: bad number in a tar header: "${text}"`);
    }
    return parseInt(text, 8);
}

/** The header's own checksum: every byte summed, its own field counted as spaces. */
function checksumOf(header: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < BLOCK_SIZE; i++) {
        sum += i >= CHECKSUM[0] && i < CHECKSUM[1] ? 0x20 : header[i];
    }
    return sum;
}

function parseIndex(parts: Uint8Array<ArrayBuffer>[]): NotationBundleIndex {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = parts.map((part) => decoder.decode(part, { stream: true })).join('');
    const parsed = JSON.parse(text + decoder.decode()) as Partial<NotationBundleIndex> | null;

    if (parsed?.version !== SUPPORTED_VERSION) {
        throw new Error(`Notation archive: unsupported version ${String(parsed?.version)}`);
    }
    if (typeof parsed.generated !== 'string') {
        throw new Error('Notation archive: the index has no generation time');
    }
    const { files } = parsed;
    if (!files || typeof files !== 'object' || Array.isArray(files)) {
        throw new Error('Notation archive: the index lists no files');
    }
    for (const [id, entry] of Object.entries(files)) {
        const stampOk = entry?.modifiedOn === null || typeof entry?.modifiedOn === 'string';
        if (!stampOk || typeof entry?.type !== 'string' || !entry.type) {
            throw new Error(`Notation archive: the index entry for ${id} is malformed`);
        }
    }
    return parsed as NotationBundleIndex;
}

/**
 * The tar reader, fed whatever chunks the stream happens to cut. Nothing may be
 * assumed about those: a chunk can end inside a header, and the only state that
 * has to survive between two of them is where in the archive the last one left
 * off.
 */
class ArchiveParser {
    private readonly header = new Uint8Array(BLOCK_SIZE);
    private headerFill = 0;
    private entry: {
        name: string;
        size: number;
        remaining: number;
        parts: Uint8Array<ArrayBuffer>[];
    } | null = null;
    private padding = 0;
    private ended = false;

    private index: NotationBundleIndex | null = null;
    /** What the index listed and no entry has answered yet. */
    private readonly unseen = new Map<string, NotationBundleEntry>();
    private readonly files: NotationBundleFile[] = [];

    push(chunk: Uint8Array<ArrayBuffer>): void {
        let at = 0;
        while (at < chunk.length) {
            if (this.ended) {
                this.assertOnlyZeros(chunk.subarray(at));
                return;
            }

            const available = chunk.length - at;
            if (this.entry) {
                const take = Math.min(this.entry.remaining, available);
                this.entry.parts.push(chunk.subarray(at, at + take));
                this.entry.remaining -= take;
                at += take;
                if (this.entry.remaining === 0) this.closeEntry();
            } else if (this.padding > 0) {
                const skip = Math.min(this.padding, available);
                this.padding -= skip;
                at += skip;
            } else {
                const take = Math.min(BLOCK_SIZE - this.headerFill, available);
                this.header.set(chunk.subarray(at, at + take), this.headerFill);
                this.headerFill += take;
                at += take;
                if (this.headerFill === BLOCK_SIZE) {
                    this.headerFill = 0;
                    this.openEntry();
                }
            }
        }
    }

    finish(): NotationBundle {
        // Only a whole zero block sets this, so it also covers a stream that
        // stopped inside an entry, its padding or a header.
        if (!this.ended || !this.index) {
            throw new Error('Notation archive: truncated, no end-of-archive block');
        }
        if (this.unseen.size > 0) {
            throw new Error(`Notation archive: ${this.unseen.size} listed files have no entry`);
        }
        return { index: this.index, files: this.files };
    }

    private openEntry(): void {
        const header = this.header;

        if (header.every((byte) => byte === 0)) {
            if (!this.index) {
                throw new Error(`Notation archive: the first entry is not ${INDEX_ENTRY_NAME}`);
            }
            this.ended = true;
            return;
        }

        if (readOctal(header, CHECKSUM) !== checksumOf(header)) {
            throw new Error('Notation archive: a tar header fails its checksum');
        }

        const name = readText(header, NAME);
        // Every name here is index.json or a file id, and neither needs the field.
        if (readText(header, PREFIX)) {
            throw new Error(`Notation archive: ${name} has a path prefix`);
        }

        if (!this.index && name !== INDEX_ENTRY_NAME) {
            throw new Error(`Notation archive: the first entry is not ${INDEX_ENTRY_NAME}`);
        }
        if (header[TYPEFLAG] !== REGULAR_FILE) {
            throw new Error(`Notation archive: ${name} is not a regular file`);
        }
        if (this.index && !this.unseen.has(name)) {
            throw new Error(`Notation archive: ${name} is unlisted in the index, or appears twice`);
        }

        const size = readOctal(header, SIZE);
        this.entry = { name, size, remaining: size, parts: [] };
    }

    private closeEntry(): void {
        const { name, size, parts } = this.entry!;
        this.entry = null;
        this.padding = (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE;

        if (!this.index) {
            this.index = parseIndex(parts);
            for (const [id, entry] of Object.entries(this.index.files)) {
                this.unseen.set(id, entry);
            }
            return;
        }

        const listed = this.unseen.get(name)!;
        this.unseen.delete(name);
        this.files.push({
            id: name,
            blob: new Blob(parts, { type: listed.type }),
            modifiedOn: listed.modifiedOn,
        });
    }

    /** tar pads its end with zeros. Anything else there is an entry no index vouches for. */
    private assertOnlyZeros(rest: Uint8Array): void {
        if (rest.some((byte) => byte !== 0)) {
            throw new Error('Notation archive: data after the end-of-archive block');
        }
    }
}

/**
 * Parse an already decompressed tar stream. Separate from `readNotationBundle`
 * so the tests can cut the tar's own bytes at any point; through gzip they have
 * no say in where the chunks fall.
 */
export async function parseNotationTar(
    stream: ReadableStream<Uint8Array<ArrayBuffer>>,
): Promise<NotationBundle> {
    const parser = new ArchiveParser();
    // A reader rather than `for await`: Safari's streams are not async-iterable.
    const reader = stream.getReader();

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.push(value);
        }
    } catch (err) {
        // A parse error leaves the pipeline running, and it is already over.
        // Not awaited: tearing it down must not hold up the fallback.
        void reader.cancel(err).catch(() => undefined);
        throw err;
    }

    return parser.finish();
}

/**
 * Read the archive. Entries are held as Blobs and this returns only once the
 * stream has been consumed to its end, because the gzip CRC sits in the last
 * bytes: nothing can reach IndexedDB before the whole archive has been checked.
 */
export async function readNotationBundle(
    source: Blob | ReadableStream<Uint8Array<ArrayBuffer>>,
): Promise<NotationBundle> {
    const compressed = source instanceof Blob ? source.stream() : source;
    return parseNotationTar(compressed.pipeThrough(new DecompressionStream('gzip')));
}

/**
 * Whether two `modified_on` stamps name the same moment.
 *
 * Never a string comparison: the index was asked for by gb-scripts at build time
 * and the manifest by this app at sync time, and a server in between may serialise
 * one instant differently. Both null counts as agreeing, which is the case where
 * the server keeps no stamp at all. A stamp that does not parse agrees with
 * nothing, itself included, because a mismatch only costs a download.
 */
export function sameFileStamp(a: string | null, b: string | null): boolean {
    if (a === null || b === null) return a === b;

    return Date.parse(a) === Date.parse(b);
}
