import type { Song } from '@/db';
import { demoUrl } from '@/services/demoAccess';

/**
 * Demo API: the handful of songs behind a demo link (see worker/demo.ts).
 */

/**
 * Why the songs could not be had. `closed` is the endpoint saying so — an
 * unknown key or one past its date, which it deliberately does not tell apart.
 * `unreachable` is anything else: offline, a 5xx, a backend that is down.
 * Only `closed` may ever take songs off a device.
 */
export class DemoUnavailableError extends Error {
    constructor(readonly reason: 'closed' | 'unreachable') {
        super(`Demo ${reason}`);
        this.name = 'DemoUnavailableError';
    }
}

export async function fetchDemoSongs(key: string): Promise<Song[]> {
    let response: Response;
    try {
        response = await fetch(demoUrl(key), { cache: 'no-store' });
    } catch {
        throw new DemoUnavailableError('unreachable');
    }

    if (response.status === 404 || response.status === 410) {
        throw new DemoUnavailableError('closed');
    }
    if (!response.ok) {
        throw new DemoUnavailableError('unreachable');
    }

    try {
        const body = (await response.json()) as { songs?: Song[] };
        return body.songs ?? [];
    } catch {
        // Not the endpoint answering — a deploy without the Worker serves the
        // app's index.html here, with a 200.
        throw new DemoUnavailableError('unreachable');
    }
}
