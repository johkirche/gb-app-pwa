import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A device signed out from another one ends its own session as soon as it sees
 * the list without itself in it — and on nothing less than such a list.
 */

const listDevices = vi.fn();
const handleInvalidCredentials = vi.fn();
const userStore = { isLoggedIn: true, devSkipAuth: false };

vi.mock('@/api/einstieg.api', () => ({ listDevices: () => listDevices() }));
vi.mock('@/services/errorHandler', () => ({
    handleInvalidCredentials: (...args: unknown[]) => handleInvalidCredentials(...args),
}));
vi.mock('@/stores/user', () => ({ useUserStore: () => userStore }));

type Module = typeof import('./deviceCheck');
let check: Module['checkThisDevice'];

function device(id: number, current: boolean) {
    return { id, name: `Gerät ${id}`, last_seen: '', signed_in: '', current };
}

beforeEach(async () => {
    // The throttle lives at module level, as it does in the app.
    vi.resetModules();
    ({ checkThisDevice: check } = await import('./deviceCheck'));
    listDevices.mockReset();
    handleInvalidCredentials.mockReset();
    Object.assign(userStore, { isLoggedIn: true, devSkipAuth: false });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

describe('checkThisDevice', () => {
    it('stays signed in while the list has this device', async () => {
        listDevices.mockResolvedValue({ limit: 4, devices: [device(1, false), device(2, true)] });

        await check();

        expect(handleInvalidCredentials).not.toHaveBeenCalled();
    });

    it('ends the session when the list no longer has it', async () => {
        listDevices.mockResolvedValue({ limit: 4, devices: [device(1, false)] });

        await check();

        expect(handleInvalidCredentials).toHaveBeenCalledWith('device_signed_out');
    });

    it('ends it on an empty list too', async () => {
        listDevices.mockResolvedValue({ limit: 4, devices: [] });

        await check();

        expect(handleInvalidCredentials).toHaveBeenCalledOnce();
    });

    it('takes a list that could not be had as no answer', async () => {
        listDevices.mockRejectedValue(new Error('offline'));

        await check();

        expect(handleInvalidCredentials).not.toHaveBeenCalled();
    });

    it('takes an answer that is not a list as no answer', async () => {
        listDevices.mockResolvedValue({ unexpected: true });

        await check();

        expect(handleInvalidCredentials).not.toHaveBeenCalled();
    });

    it('asks nothing without a session, or offline', async () => {
        userStore.isLoggedIn = false;
        await check();

        userStore.isLoggedIn = true;
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        await check();

        expect(listDevices).not.toHaveBeenCalled();
    });

    it('asks at most once a minute', async () => {
        listDevices.mockResolvedValue({ limit: 4, devices: [device(1, true)] });

        await check();
        await check();

        expect(listDevices).toHaveBeenCalledOnce();
    });

    it('leaves a session that ended while the list was on its way', async () => {
        listDevices.mockImplementation(async () => {
            userStore.isLoggedIn = false;
            return { limit: 4, devices: [] };
        });

        await check();

        expect(handleInvalidCredentials).not.toHaveBeenCalled();
    });
});
