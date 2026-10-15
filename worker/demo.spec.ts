// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type DemoEnv, handleDemoRequest, resetDemoCache } from './demo';

const env: DemoEnv = {
    DIRECTUS_URL: 'https://directus.test',
    DEMO_DIRECTUS_TOKEN: 'service-token',
    DEMO_KEY: 'k3y-r1ght',
    DEMO_UNTIL: '2026-11-03T00:00:00+01:00',
};
const before = Date.parse('2026-10-31T10:00:00+01:00');
const after = Date.parse('2026-11-03T00:00:01+01:00');

const SVG_ID = '0b5d4f3a-1111-4c1e-9a6e-000000000001';
const XML_ID = '0b5d4f3a-1111-4c1e-9a6e-000000000002';

function lied(id: string, titel: string, files = false) {
    return {
        id,
        titel,
        liednummer2026: Number(id),
        notentext_svg: files ? { id: SVG_ID, filename_download: 'a.svg' } : null,
        notentext_mxml: files ? { id: XML_ID, filename_download: 'a.musicxml' } : null,
        textId: null,
        melodieId: null,
        kategorieId: [],
    };
}

const directus = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
    resetDemoCache();
    directus.mockReset();
    directus.mockImplementation(async (url) => {
        if (url.includes('/items/settings')) {
            // The shape Directus' many-items dropdown stores.
            return Response.json({
                data: {
                    pfingsten_songs: [
                        { key: 12, collection: 'gesangbuchlied' },
                        { key: 7, collection: 'gesangbuchlied' },
                    ],
                },
            });
        }
        if (url.endsWith('/graphql')) {
            // Out of list order on purpose.
            return Response.json({
                data: { gesangbuchlied: [lied('7', 'Sieben'), lied('12', 'Zwölf', true)] },
            });
        }
        if (url.includes('/assets/')) {
            return new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } });
        }
        return new Response(null, { status: 500 });
    });
    vi.stubGlobal('fetch', directus);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const get = (path: string, e: DemoEnv = env, now = before) =>
    handleDemoRequest(new Request(`https://gb.test${path}`), e, now);

describe('demo endpoint', () => {
    it('serves the listed songs, in the order of the list', async () => {
        const response = await get('/api/demo/k3y-r1ght');

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        const body = await response.json();
        expect(body.songs.map((s: { titel: string }) => s.titel)).toEqual(['Zwölf', 'Sieben']);

        const [, init] = directus.mock.calls.find(([url]) => url.endsWith('/graphql'))!;
        expect(JSON.parse(String(init?.body)).variables.filter).toEqual({
            id: { _in: ['12', '7'] },
        });
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer service-token');
    });

    it('answers a wrong key and a switched-off demo alike, without asking Directus', async () => {
        expect((await get('/api/demo/k3y-wrong')).status).toBe(404);
        expect((await get('/api/demo/k3y-r1ght', { ...env, DEMO_KEY: undefined })).status).toBe(
            404,
        );
        expect(directus).not.toHaveBeenCalled();
    });

    it('takes a key stored with the newline it was pasted with', async () => {
        expect(
            (await get('/api/demo/k3y-r1ght', { ...env, DEMO_KEY: ' k3y-r1ght\n' })).status,
        ).toBe(200);
    });

    it('closes after DEMO_UNTIL, and when the date does not parse', async () => {
        expect((await get('/api/demo/k3y-r1ght', env, after)).status).toBe(410);
        expect((await get('/api/demo/k3y-r1ght', { ...env, DEMO_UNTIL: 'Sonntag' })).status).toBe(
            410,
        );
        expect(directus).not.toHaveBeenCalled();
    });

    it("serves a listed song's notation file", async () => {
        const response = await get(`/api/demo/k3y-r1ght/assets/${SVG_ID}`);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
        expect(await response.text()).toBe('<svg/>');
    });

    it('refuses any other file, so the endpoint is no way into the library', async () => {
        const response = await get(
            '/api/demo/k3y-r1ght/assets/0b5d4f3a-9999-4c1e-9a6e-00000000dead',
        );

        expect(response.status).toBe(404);
        expect(directus.mock.calls.some(([url]) => url.includes('/assets/'))).toBe(false);
    });

    it('asks Directus for the list once a minute, not once a visitor', async () => {
        await get('/api/demo/k3y-r1ght');
        await get('/api/demo/k3y-r1ght', env, before + 30_000);
        await get(`/api/demo/k3y-r1ght/assets/${XML_ID}`, env, before + 45_000);

        expect(directus.mock.calls.filter(([url]) => url.endsWith('/graphql'))).toHaveLength(1);
    });

    it('reports a backend it cannot reach as a 502, never as a closed demo', async () => {
        directus.mockResolvedValue(new Response(null, { status: 503 }));

        expect((await get('/api/demo/k3y-r1ght')).status).toBe(502);
    });

    it('takes bare ids too, and ignores entries from another collection', async () => {
        directus.mockImplementation(async (url) =>
            url.includes('/items/settings')
                ? Response.json({
                      data: {
                          pfingsten_songs: ['12', 7, { key: 3, collection: 'autor' }, null],
                      },
                  })
                : Response.json({ data: { gesangbuchlied: [] } }),
        );

        await get('/api/demo/k3y-r1ght');

        const [, init] = directus.mock.calls.find(([url]) => url.endsWith('/graphql'))!;
        expect(JSON.parse(String(init?.body)).variables.filter.id._in).toEqual(['12', '7']);
    });

    it('serves an empty list as an empty list', async () => {
        directus.mockImplementation(async () => Response.json({ data: { pfingsten_songs: null } }));

        const body = await (await get('/api/demo/k3y-r1ght')).json();
        expect(body.songs).toEqual([]);
        expect(directus.mock.calls.some(([url]) => url.endsWith('/graphql'))).toBe(false);
    });
});
