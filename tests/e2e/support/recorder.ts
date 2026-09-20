import type { BrowserContext, Route } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

/*
 * A recorded backend, held as plain files.
 *
 * This started as Playwright's routeFromHAR, which is the obvious tool and
 * failed at this scale: the tracer reads response bodies back out of Chromium
 * over CDP after the fact, and across a sync of 1121 assets every single body
 * came back empty (all pointing at the sha1 of the empty string) while the four
 * GraphQL responses recorded fine. It reproduces locally at 600 requests,
 * serial or parallel, in every combination of updateMode and updateContent.
 *
 * So the recorder never asks for a body back. It intercepts the request, does
 * the fetch itself, and keeps the bytes it was handed — the body is in hand
 * before anything can evict it. Replay serves those same bytes.
 */

const ROOT = 'tests/e2e/fixtures/backend';
const INDEX = join(ROOT, 'index.json');
const BODIES = join(ROOT, 'bodies');

interface Recorded {
    key: string;
    method: string;
    url: string;
    status: number;
    headers: Record<string, string>;
    /** Basename under bodies/, gzipped on disk. Absent for an empty body. */
    file?: string;
    size: number;
}

/**
 * What makes two requests the same request.
 *
 * The URL alone will not do: the app posts three different GraphQL documents
 * (Songs, Manifest, Counts) to one endpoint, so the body has to be part of the
 * identity — the same reason Playwright's own HAR matcher compares POST bodies.
 */
function keyFor(method: string, url: string, postData: string | null): string {
    const h = createHash('sha1');
    h.update(`${method}\n${url}\n${postData ?? ''}`);
    return h.digest('hex');
}

/** Response headers worth keeping: enough to be a faithful reply, no more. */
const KEEP_HEADERS = new Set(['content-type', 'cache-control', 'etag', 'last-modified']);

/**
 * The backend is a different origin, and every asset request carries an
 * Authorization header — which makes it a non-simple cross-origin request, so
 * the browser wants a preflight and a CORS-bearing reply. Those headers are
 * synthesised here rather than replayed: Chromium and Firefox accept a fulfil
 * without them, WebKit does not, and a recording made before anyone noticed
 * should not have to be taken again for it.
 */
function corsHeaders(origin: string | undefined): Record<string, string> {
    return {
        'access-control-allow-origin': origin || '*',
        'access-control-expose-headers': 'Content-Range',
    };
}

function load(): Map<string, Recorded> {
    if (!existsSync(INDEX)) return new Map();
    const rows = JSON.parse(readFileSync(INDEX, 'utf8')) as Recorded[];
    return new Map(rows.map((r) => [r.key, r]));
}

export function hasRecording(): boolean {
    return existsSync(INDEX) && load().size > 0;
}

export function recordingSize(): { entries: number; bytes: number } {
    const rows = [...load().values()];
    return { entries: rows.length, bytes: rows.reduce((n, r) => n + r.size, 0) };
}

/**
 * Record every backend call this context makes, then write the fixture.
 * Returns the finaliser — call it once the traffic is done.
 */
export async function startRecording(context: BrowserContext, urlGlob: string) {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(BODIES, { recursive: true });

    const seen = new Map<string, Recorded>();

    await context.route(urlGlob, async (route: Route) => {
        const request = route.request();
        // Playwright performs the request and hands us the bytes. Nothing is
        // read back out of the browser afterwards, which is the whole point.
        const response = await route.fetch();
        const body = await response.body();

        const key = keyFor(request.method(), request.url(), request.postData());
        if (!seen.has(key)) {
            const headers: Record<string, string> = {};
            for (const [name, value] of Object.entries(response.headers())) {
                if (KEEP_HEADERS.has(name.toLowerCase())) headers[name.toLowerCase()] = value;
            }

            let file: string | undefined;
            if (body.length) {
                // Gzipped on disk: an engraving is a text document, and the
                // fixture is the whole book. Uncompressed it would be ~52 MB.
                file = `${createHash('sha1').update(body).digest('hex')}.gz`;
                const path = join(BODIES, file);
                if (!existsSync(path)) writeFileSync(path, gzipSync(body, { level: 9 }));
            }

            seen.set(key, {
                key,
                method: request.method(),
                url: request.url(),
                status: response.status(),
                headers,
                file,
                size: body.length,
            });
        }

        await route.fulfill({ response, body });
    });

    return function finish() {
        mkdirSync(dirname(INDEX), { recursive: true });
        writeFileSync(INDEX, JSON.stringify([...seen.values()], null, 0));
        const bytes = [...seen.values()].reduce((n, r) => n + r.size, 0);
        const onDisk = readdirSync(BODIES).reduce(
            (n, f) => n + readFileSync(join(BODIES, f)).length,
            0,
        );
        return { entries: seen.size, bytes, onDisk };
    };
}

/**
 * Serve the recorded backend. Anything not in the recording is failed rather
 * than passed through, so a request that would have reached the real Directus
 * fails the test instead of turning the suite into a live integration run.
 */
export async function serveRecording(context: BrowserContext, urlGlob: string) {
    const index = load();
    const missing: string[] = [];

    await context.route(urlGlob, async (route: Route) => {
        const request = route.request();
        const origin = request.headers()['origin'];

        // Preflights never reached the recorder — the browser issues them below
        // the level route handlers see — so they are answered from first
        // principles instead of from the fixture.
        if (request.method() === 'OPTIONS') {
            await route.fulfill({
                status: 204,
                headers: {
                    ...corsHeaders(origin),
                    'access-control-allow-methods': 'GET, POST, OPTIONS',
                    'access-control-allow-headers':
                        request.headers()['access-control-request-headers'] ||
                        'authorization, content-type',
                    'access-control-max-age': '86400',
                },
                body: '',
            });
            return;
        }

        const hit = index.get(keyFor(request.method(), request.url(), request.postData()));
        if (!hit) {
            missing.push(`${request.method()} ${request.url()}`);
            await route.abort('failed');
            return;
        }
        const body = hit.file ? gunzipSync(readFileSync(join(BODIES, hit.file))) : Buffer.alloc(0);
        await route.fulfill({
            status: hit.status,
            headers: { ...hit.headers, ...corsHeaders(origin) },
            body,
        });
    });

    return () => missing;
}
