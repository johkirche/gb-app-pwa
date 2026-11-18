import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { usePWA as usePWAType } from '@/composables/usePWA';

// The composable keeps its state at module level and initialises once, so each
// test loads a fresh copy of it.
let usePWA: typeof usePWAType;
let getInstalledRelatedApps: ReturnType<typeof vi.fn> | undefined;

function runningAsApp(standalone: boolean) {
    window.matchMedia = vi.fn(() => ({
        matches: standalone,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
}

function browserAnswers(answer: () => Promise<unknown>) {
    getInstalledRelatedApps = vi.fn(answer);
    Object.defineProperty(navigator, 'getInstalledRelatedApps', {
        value: getInstalledRelatedApps,
        configurable: true,
    });
}

/** What Chrome hands back for the manifest's own entry once the WebAPK is there. */
const theApp = {
    platform: 'webapp',
    url: 'https://gesangbuch.example/manifest.webmanifest',
};

async function start() {
    ({ usePWA } = await import('@/composables/usePWA'));
    const pwa = usePWA();
    pwa.initPWAListeners();
    // The browser's answer is a promise; let it land.
    await vi.advanceTimersByTimeAsync(0);
    return pwa;
}

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    runningAsApp(false);
});

function onDevice(userAgent: string, maxTouchPoints = 0) {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', {
        value: maxTouchPoints,
        configurable: true,
    });
}

const USER_AGENT = {
    iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    // What Safari sends from a Mac, and from an iPad asking for the desktop
    // site, which since iPadOS 13 is every iPad unless told otherwise.
    macSafari:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    android:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
};

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'getInstalledRelatedApps');
    Reflect.deleteProperty(navigator, 'userAgent');
    Reflect.deleteProperty(navigator, 'maxTouchPoints');
    getInstalledRelatedApps = undefined;
});

describe('telling the devices apart', () => {
    async function platform() {
        ({ usePWA } = await import('@/composables/usePWA'));
        const { isIOS, isAndroid } = usePWA();
        return { isIOS: isIOS.value, isAndroid: isAndroid.value };
    }

    it('knows an iPhone', async () => {
        onDevice(USER_AGENT.iPhone, 5);
        expect(await platform()).toEqual({ isIOS: true, isAndroid: false });
    });

    it('knows an iPad that asks for the desktop site', async () => {
        onDevice(USER_AGENT.macSafari, 5);
        expect(await platform()).toEqual({ isIOS: true, isAndroid: false });
    });

    it('does not take a Mac for an iPad', async () => {
        onDevice(USER_AGENT.macSafari, 0);
        expect(await platform()).toEqual({ isIOS: false, isAndroid: false });
    });

    it('knows an Android phone', async () => {
        onDevice(USER_AGENT.android, 5);
        expect(await platform()).toEqual({ isIOS: false, isAndroid: true });
    });

    it('does not suspect an iPad of having the app because Safari offered no install', async () => {
        // Safari never fires beforeinstallprompt, so its silence says nothing.
        onDevice(USER_AGENT.macSafari, 5);
        const pwa = await start();

        await vi.advanceTimersByTimeAsync(1500);
        expect(pwa.isSuspectedInstalled.value).toBe(false);
    });
});

describe('asking the browser whether the app is installed', () => {
    it('knows the app is there when the browser finds it', async () => {
        browserAnswers(async () => [theApp]);
        const pwa = await start();

        expect(pwa.isKnownInstalled.value).toBe(true);
        expect(pwa.isCheckingInstall.value).toBe(false);

        // The timer's guess has nothing left to add.
        await vi.advanceTimersByTimeAsync(1500);
        expect(pwa.isSuspectedInstalled.value).toBe(false);
    });

    it('keeps to its guess when the browser finds nothing', async () => {
        // An app added as a plain shortcut answers like this too, so an empty
        // list is no proof of anything.
        browserAnswers(async () => []);
        const pwa = await start();

        expect(pwa.isKnownInstalled.value).toBe(false);
        expect(pwa.isCheckingInstall.value).toBe(true);

        await vi.advanceTimersByTimeAsync(1500);
        expect(pwa.isSuspectedInstalled.value).toBe(true);
    });

    it('treats a refused question as not knowing', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        browserAnswers(async () => {
            throw new DOMException('not top-level', 'InvalidStateError');
        });
        const pwa = await start();

        expect(pwa.isKnownInstalled.value).toBe(false);
        await vi.advanceTimersByTimeAsync(1500);
        expect(pwa.isSuspectedInstalled.value).toBe(true);
    });

    it('leaves a browser without the call to the guess', async () => {
        const pwa = await start();

        expect(pwa.isKnownInstalled.value).toBe(false);
        await vi.advanceTimersByTimeAsync(1500);
        expect(pwa.isSuspectedInstalled.value).toBe(true);
    });

    it('does not ask from inside the installed app', async () => {
        runningAsApp(true);
        browserAnswers(async () => [theApp]);
        const pwa = await start();

        expect(getInstalledRelatedApps).not.toHaveBeenCalled();
        expect(pwa.isStandalone.value).toBe(true);
        expect(pwa.isKnownInstalled.value).toBe(false);
    });
});
