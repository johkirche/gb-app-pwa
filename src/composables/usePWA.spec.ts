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

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'getInstalledRelatedApps');
    getInstalledRelatedApps = undefined;
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
