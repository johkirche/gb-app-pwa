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
 * Rough upper estimate of a full content download (songs + note files).
 * Used only for the pre-sync free-space warning — the real backstop is the
 * QuotaExceededError handling during the download itself.
 */
// Measured against the production backend on 2026-08-17: the sync downloads
// ~230 files (PNG/JPG/SVG notation + MusicXML) totalling ~15 MB. 30 MB leaves
// headroom for content growth without scaring users with an inflated figure.
export const ESTIMATED_SYNC_BYTES = 30 * 1024 * 1024;

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
