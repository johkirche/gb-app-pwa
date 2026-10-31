import { type DirectusResponse, SONGS_QUERY, transformSong } from '../src/api/songsQuery';
import type { Song } from '../src/db';

/**
 * The demo link: a handful of songs for people without an account.
 *
 * An event (Refofest) sings a few songs from the new book and hands the
 * congregation a QR code. Nobody in the hall has a Directus login, and the
 * book as a whole is not ours to open to the world — so this endpoint carries
 * the authority instead of the visitor: it holds a service token, and answers
 * for exactly the songs listed in the `settings` singleton and the two notation
 * files each of them points at. Nothing else of the backend is reachable
 * through it.
 *
 *   GET /api/demo/<key>              → { songs, until, playback }
 *   GET /api/demo/<key>/assets/<id>  → the file, if it belongs to one of them
 *
 * Three ways to close it again, none of which need a deploy: unset DEMO_KEY
 * (every link answers 404), let DEMO_UNTIL pass (410), or empty the list in
 * Directus. The app reads 404 and 410 as "this demo is over" and clears what it
 * stored, so a closed link also takes the songs back off the phones that
 * already opened it — the next time they are online.
 */

export interface DemoEnv {
    /** The Directus instance, without a trailing slash. */
    DIRECTUS_URL?: string;
    /** A read-only static token: the settings singleton, the songs, their files. */
    DEMO_DIRECTUS_TOKEN?: string;
    /** The unguessable part of the link. Unset, the demo is off. */
    DEMO_KEY?: string;
    /** ISO timestamp after which the link answers 410. Unset, it does not expire. */
    DEMO_UNTIL?: string;
    /**
     * ISO timestamp from which the demo's songs can be played. Unset, they
     * cannot: the link is first scanned in the hall where the songs are being
     * sung, and a phone playing over the congregation is a disturbance. Once
     * the event is over there is nobody left to disturb.
     */
    DEMO_PLAYBACK_FROM?: string;
}

/** The `settings` field the songs are dropped into in Directus. */
const SONG_LIST_FIELD = 'pfingsten_songs';

/**
 * How long one isolate trusts the list it fetched. A QR code on a screen sends
 * a few hundred phones at the same minute; this keeps that from being a few
 * hundred trips to Directus, and is still short enough that a song dropped in
 * shows up on the next open.
 */
const LIST_TTL_MS = 60_000;

/** A notation file never changes under its id — a new rendering is a new upload. */
const ASSET_MAX_AGE_S = 60 * 60 * 24;

let memo: { at: number; songs: Song[] } | null = null;

/** For tests: forget the memoised list. */
export function resetDemoCache(): void {
    memo = null;
}

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // Never stored on the way: the answer has to change the moment the
            // demo closes.
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex',
        },
    });
}

/** Compared in constant time, so the key cannot be found a character at a time. */
function sameKey(given: string, expected: string): boolean {
    if (given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < given.length; i++) {
        diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
}

function hasEnded(env: DemoEnv, now: number): boolean {
    if (!env.DEMO_UNTIL) return false;
    const until = Date.parse(env.DEMO_UNTIL);
    // A value that does not parse closes the demo rather than leaving it open
    // for good: a typo should fail towards the copyright, not away from it.
    return Number.isNaN(until) || now > until;
}

/** Like DEMO_UNTIL, a value that does not parse fails towards the hall: silent. */
function playsFrom(env: DemoEnv, now: number): boolean {
    if (!env.DEMO_PLAYBACK_FROM) return false;
    const from = Date.parse(env.DEMO_PLAYBACK_FROM);
    return !Number.isNaN(from) && now >= from;
}

async function directus<T>(env: DemoEnv, path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${env.DIRECTUS_URL}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${env.DEMO_DIRECTUS_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Directus ${path}: ${response.status}`);
    }
    return (await response.json()) as T;
}

/** The listed songs, in the order they were dropped into the list. */
async function loadSongs(env: DemoEnv, now: number): Promise<Song[]> {
    if (memo && now - memo.at < LIST_TTL_MS) return memo.songs;

    const settings = await directus<{ data: Record<string, unknown> | null }>(
        env,
        `/items/settings?fields=${SONG_LIST_FIELD}`,
    );
    const ids = listedIds(settings.data?.[SONG_LIST_FIELD]);

    let songs: Song[] = [];
    if (ids.length > 0) {
        // No "Rein" filter here, unlike the app's sync: the list is chosen by
        // hand, song by song, and is the whole of what this endpoint offers.
        const result = await directus<{ data: DirectusResponse; errors?: unknown[] }>(
            env,
            '/graphql',
            {
                method: 'POST',
                body: JSON.stringify({
                    query: SONGS_QUERY,
                    variables: { filter: { id: { _in: ids } } },
                }),
            },
        );
        if (result.errors?.length || !result.data) {
            throw new Error(`Directus /graphql: ${JSON.stringify(result.errors)}`);
        }
        const position = new Map(ids.map((id, i) => [id, i]));
        songs = result.data.gesangbuchlied
            .map(transformSong)
            .sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
    }

    memo = { at: now, songs };
    return songs;
}

/**
 * The song ids out of the list field. Directus' many-items dropdown stores
 * `{ key, collection }` per entry; a bare id is taken too, should the field
 * ever be switched to a plain list.
 */
function listedIds(listed: unknown): string[] {
    if (!Array.isArray(listed)) return [];
    return listed.flatMap((entry) => {
        if (typeof entry === 'string' || typeof entry === 'number') return [String(entry)];
        if (entry && typeof entry === 'object' && 'key' in entry) {
            const { key, collection } = entry as { key: unknown; collection?: unknown };
            if (collection !== undefined && collection !== 'gesangbuchlied') return [];
            if (typeof key === 'string' || typeof key === 'number') return [String(key)];
        }
        return [];
    });
}

function notationFileIds(songs: Song[]): Set<string> {
    const ids = new Set<string>();
    for (const song of songs) {
        if (song.notentextSvg) ids.add(song.notentextSvg.id);
        if (song.notentextMxml) ids.add(song.notentextMxml.id);
    }
    return ids;
}

/** The Workers cache, where there is one — not under the Vite dev server. */
function edgeCache(): Cache | null {
    const storage = (globalThis as { caches?: { default?: Cache } }).caches;
    return storage?.default ?? null;
}

async function serveAsset(env: DemoEnv, fileId: string, request: Request): Promise<Response> {
    const cache = edgeCache();
    // Keyed without the demo key, so a rotated link does not refetch every file.
    const cacheKey = new Request(new URL(`/__demo-asset/${fileId}`, request.url).toString());
    const cached = await cache?.match(cacheKey);
    if (cached) return cached;

    const upstream = await fetch(`${env.DIRECTUS_URL}/assets/${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${env.DEMO_DIRECTUS_TOKEN}` },
    });
    if (!upstream.ok) {
        return json(502, { error: 'asset unavailable' });
    }

    const response = new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
            'Cache-Control': `private, max-age=${ASSET_MAX_AGE_S}`,
            'X-Robots-Tag': 'noindex',
        },
    });
    if (cache) {
        await cache.put(cacheKey, response.clone());
    }
    return response;
}

export async function handleDemoRequest(
    request: Request,
    env: DemoEnv,
    now = Date.now(),
): Promise<Response> {
    if (request.method !== 'GET') {
        return json(405, { error: 'method not allowed' });
    }

    const match = new URL(request.url).pathname.match(
        /^\/api\/demo\/([^/]+)(?:\/assets\/([0-9a-f-]+))?\/?$/i,
    );
    // Unknown and switched-off answer alike, so the endpoint says nothing
    // about whether a demo is running to someone guessing at it.
    // Trimmed: a secret pasted into the dashboard easily keeps the newline
    // that came with it, and no link can carry one.
    const key = env.DEMO_KEY?.trim();
    if (!match || !key || !sameKey(decodeURIComponent(match[1]), key)) {
        return json(404, { error: 'not found' });
    }
    if (hasEnded(env, now)) {
        return json(410, { error: 'ended' });
    }
    if (!env.DIRECTUS_URL || !env.DEMO_DIRECTUS_TOKEN) {
        console.error('Demo endpoint: DIRECTUS_URL or DEMO_DIRECTUS_TOKEN is not set');
        return json(503, { error: 'not configured' });
    }

    let songs: Song[];
    try {
        songs = await loadSongs(env, now);
    } catch (err) {
        console.error('Demo endpoint: could not load the song list', err);
        return json(502, { error: 'backend unavailable' });
    }

    const fileId = match[2];
    if (fileId) {
        if (!notationFileIds(songs).has(fileId)) {
            return json(404, { error: 'not found' });
        }
        return serveAsset(env, fileId, request);
    }

    return json(200, {
        songs,
        until: env.DEMO_UNTIL ?? null,
        // Decided here rather than on the phone, so the Worker's clock is the
        // one that counts — the same clock that closes the demo.
        playback: playsFrom(env, now),
    });
}
