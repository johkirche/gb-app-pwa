/**
 * Storage Service
 *
 * Wraps the StorageManager API (navigator.storage) with graceful degradation:
 * on browsers without support (older Safari, some WebViews) every helper
 * resolves to false/null so callers can simply hide the related UI.
 */

export interface StorageSpace {
    usage: number;
    quota: number;
}

/**
 * What a full download costs — over the wire, and on the device.
 *
 * These are two different numbers and the gap is wide, so the app stopped
 * quoting one for both. The backend serves the notation gzipped, and an
 * engraving is a text document: it arrives at a fraction of the size it then
 * occupies once the browser has unpacked it into a Blob in IndexedDB.
 *
 * Measured against the production backend on 2026-09-20, after the notation
 * set was re-exported with reduced coordinate precision and repeated glyph
 * outlines hoisted into <defs>/<use> (see gb-scripts):
 *
 *                        files   transfer   stored
 *   SVG notation           565     7.4 MB   50.9 MB   <- was 25.1 / 95.2 MB
 *   MusicXML               564     0.9 MB    0.9 MB   <- .mxl is already zipped
 *                                 ≈ 8 MB   ≈ 52 MB
 *
 * The legacy PNG notation (261 files, 2.7 MB) is deliberately left out: the
 * sync has not fetched it since the Notenbild moved to notentext_svg — see
 * collectSyncFileIds in api/songs.api.ts — and counting it only ever made the
 * quote too high.
 *
 * Re-measure when the notation set changes.
 */

/** What the reader's data plan pays: the compressed size on the wire. */
export const ESTIMATED_TRANSFER_BYTES = 8 * 1024 * 1024;

/** What the device gives up: the unpacked size in IndexedDB. */
export const ESTIMATED_SYNC_BYTES = 52 * 1024 * 1024;

/**
 * Free space the pre-sync check demands. Kept above ESTIMATED_SYNC_BYTES so a
 * download does not start into a nearly-full quota (IndexedDB overhead, browser
 * eviction headroom). The real backstop stays the QuotaExceededError handling
 * during the download itself.
 */
export const REQUIRED_FREE_BYTES = 75 * 1024 * 1024;

// Ask the browser to protect IndexedDB content from automatic eviction.
export async function requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage?.persist) return false;
    try {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
    } catch {
        return false;
    }
}

// Report whether persistent storage is currently granted.
// null when the API is unavailable (older Safari, some WebViews).
export async function isPersisted(): Promise<boolean | null> {
    if (!navigator.storage?.persisted) return null;
    try {
        return await navigator.storage.persisted();
    } catch {
        return null;
    }
}

export async function getStorageEstimate(): Promise<StorageSpace | null> {
    if (!navigator.storage?.estimate) return null;
    try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        return { usage, quota };
    } catch {
        return null;
    }
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function formatBytes(bytes: number): string {
    const formatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
    let value = Math.max(bytes, 0);
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${formatter.format(value)} ${BYTE_UNITS[unitIndex]}`;
}

// Hand the user a JSON file via the anchor-download pattern.
export function downloadJsonFile(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
