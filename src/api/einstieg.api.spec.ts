import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The way in, as the register extension answers it: what each route is sent,
 * how its answers and refusals come back, and the fallbacks for an extension
 * that does not have the routes yet.
 */

const BACKEND = 'https://backend.test';
const DEVICE = { id: 'geraet-im-test', name: 'Testgerät · Chrome' };

vi.mock('@/services/directus', () => ({
    directusConfig: { url: 'https://backend.test' },
    directusClient: { request: vi.fn() },
}));
vi.mock('@/services/device', () => ({ thisDevice: () => DEVICE }));

const api = await import('./einstieg.api');

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
const refusal = (code: string, status: number, extensions: Record<string, unknown> = {}) =>
    json({ errors: [{ message: code, extensions: { code, ...extensions } }] }, status);

const network = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function sent(n = 0) {
    const [url, init] = network.mock.calls[n];
    return {
        path: String(url).replace(BACKEND, ''),
        body: JSON.parse(String(init?.body)) as unknown,
        authorization: new Headers(init?.headers).get('Authorization'),
    };
}

const SESSION = {
    access_token: 'a',
    refresh_token: 'r',
    expires: 900000,
    refresh_expires: 1_800_000_000_000,
};

beforeEach(() => {
    network.mockReset();
    vi.stubGlobal('fetch', network);
});
afterEach(() => vi.unstubAllGlobals());

describe('requestCode', () => {
    it('sends the address, unsigned, and reads the waits', async () => {
        network.mockResolvedValue(json({ data: { expires_in: 900, resend_in: 30 } }));

        expect(await api.requestCode('maria@example.org')).toEqual({
            expiresIn: 900,
            resendIn: 30,
        });
        expect(sent()).toEqual({
            path: '/directus-user-register-extension/code',
            body: { email: 'maria@example.org' },
            authorization: null,
        });
    });

    it('rejects with what the refusal carried', async () => {
        network.mockResolvedValue(refusal('CODE_REQUESTED_TOO_OFTEN', 429, { retry_after: 21 }));

        const error = await api.requestCode('maria@example.org').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(api.EinstiegError);
        expect((error as InstanceType<typeof api.EinstiegError>).retryAfter).toBe(21);
        expect(api.describeEinstiegError(error)).toBe(
            'Bitte warten Sie noch 21 Sekunden, bevor Sie einen neuen Code anfordern.',
        );
    });

    it('calls a failed connection NETWORK', async () => {
        network.mockRejectedValue(new TypeError('Failed to fetch'));

        const error = await api.requestCode('maria@example.org').catch((e: unknown) => e);

        expect((error as InstanceType<typeof api.EinstiegError>).code).toBe('NETWORK');
    });
});

describe('checkCode', () => {
    it('sends the device along, and hands back a session', async () => {
        network.mockResolvedValue(json({ data: { result: 'signed_in', ...SESSION } }));

        expect(await api.checkCode('maria@example.org', '481203')).toEqual({
            result: 'signed_in',
            session: SESSION,
        });
        expect(sent().body).toEqual({ email: 'maria@example.org', code: '481203', geraet: DEVICE });
    });

    it('hands back a ticket for an address without an account', async () => {
        network.mockResolvedValue(
            json({ data: { result: 'needs_registration', ticket: 't', expires_in: 1800 } }),
        );

        expect(await api.checkCode('neu@example.org', '481203')).toEqual({
            result: 'needs_registration',
            ticket: 't',
        });
    });

    it('says how many tries are left', async () => {
        network.mockResolvedValue(refusal('CODE_INVALID', 400, { attempts_left: 1 }));

        const error = await api.checkCode('maria@example.org', '000000').catch((e: unknown) => e);

        expect(api.describeEinstiegError(error)).toBe('Dieser Code stimmt nicht. Noch 1 Versuch.');
    });

    it('turns a device limit into the devices and a ticket to swap with', async () => {
        const devices = [
            { id: 1, name: 'iPad · Safari', last_seen: '', signed_in: '', current: false },
        ];
        network.mockResolvedValue(
            refusal('DEVICE_LIMIT', 409, { limit: 4, devices, ticket: 'swap' }),
        );

        const error = await api.checkCode('maria@example.org', '481203').catch((e: unknown) => e);

        expect(api.deviceLimitOf(error)).toEqual({ limit: 4, devices, ticket: 'swap' });
    });
});

describe('loginWithPassword', () => {
    it('signs in at the extension, this device counted', async () => {
        network.mockResolvedValue(json({ data: SESSION }));

        expect(await api.loginWithPassword('maria@example.org', 'Geheim123')).toEqual(SESSION);
        expect(sent()).toMatchObject({
            path: '/directus-user-register-extension/login',
            body: { email: 'maria@example.org', password: 'Geheim123', geraet: DEVICE },
        });
    });

    it('signs in at Directus where the extension has no /login yet', async () => {
        network
            .mockResolvedValueOnce(refusal('ROUTE_NOT_FOUND', 404))
            .mockResolvedValueOnce(json({ data: SESSION }));

        expect(await api.loginWithPassword('maria@example.org', 'Geheim123')).toEqual(SESSION);
        expect(sent(1)).toMatchObject({
            path: '/auth/login',
            body: { email: 'maria@example.org', password: 'Geheim123', mode: 'json' },
        });
    });

    it('does not fall back on a wrong password', async () => {
        network.mockResolvedValue(refusal('INVALID_CREDENTIALS', 401));

        await expect(api.loginWithPassword('maria@example.org', 'falsch')).rejects.toMatchObject({
            code: 'INVALID_CREDENTIALS',
        });
        expect(network).toHaveBeenCalledOnce();
    });
});

describe('registerWithTicket', () => {
    it('sends ticket, Aktivierungscode and device, and hands back the session', async () => {
        network.mockResolvedValue(json({ success: true, user: { id: 'u' }, data: SESSION }, 201));

        expect(await api.registerWithTicket('t', 'genesis-adam-mut')).toEqual(SESSION);
        expect(sent().body).toEqual({
            ticket: 't',
            registration_code: 'genesis-adam-mut',
            geraet: DEVICE,
        });
    });

    it('says when the ticket is spent', async () => {
        network.mockResolvedValue(refusal('REGISTRATION_CODE_INVALID', 400, { attempts_left: 0 }));

        const error = await api.registerWithTicket('t', 'falsch').catch((e: unknown) => e);

        expect(api.describeEinstiegError(error)).toBe(
            'Zu viele falsche Aktivierungscodes. Bitte fordern Sie einen neuen Code per E-Mail an.',
        );
    });
});
