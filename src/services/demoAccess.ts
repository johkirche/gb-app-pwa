/**
 * The demo link this device was opened with, if any.
 *
 * A demo visitor has no session, so the files API cannot fetch a notation
 * file the usual way; it asks the demo endpoint instead, under this key. Held
 * here rather than in the songs store because the store imports the files API,
 * and the files API needs to read it back.
 */
let demoKey: string | null = null;

export function getDemoKey(): string | null {
    return demoKey;
}

export function setDemoKey(key: string | null): void {
    demoKey = key;
}

/** Where the demo endpoint answers for this key. Same origin: the Worker. */
export function demoUrl(key: string, path = ''): string {
    return `/api/demo/${encodeURIComponent(key)}${path}`;
}
