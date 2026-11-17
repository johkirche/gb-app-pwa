import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * How the app names this device to the server: an id it keeps, and a name the
 * reader recognises in the list of their devices.
 */

const UA = {
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    // An iPad since iPadOS 13 asks for the desktop site and says "Macintosh".
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    chromeOnIphone:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
    pixel: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36',
    samsungTablet:
        'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36',
    edgeOnWindows:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    firefoxOnMac:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0',
};

describe('describeDevice', () => {
    it.each([
        ['iphone', 5, false, 'iPhone · Safari'],
        ['iphone', 5, true, 'iPhone · Gesangbuch-App'],
        ['ipad', 5, false, 'iPad · Safari'],
        ['chromeOnIphone', 5, false, 'iPhone · Chrome'],
        ['pixel', 5, true, 'Android-Handy · Gesangbuch-App'],
        ['samsungTablet', 5, false, 'Android-Tablet · Samsung Internet'],
        ['edgeOnWindows', 0, false, 'Windows-PC · Edge'],
        ['firefoxOnMac', 0, false, 'Mac · Firefox'],
    ] as const)('names %s (touch points %i, installed %s) "%s"', (ua, touch, standalone, name) => {
        return import('./device').then(({ describeDevice }) => {
            expect(describeDevice(UA[ua], touch, standalone)).toBe(name);
        });
    });
});

describe('deviceId', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    it('is made once and kept', async () => {
        const first = (await import('./device')).deviceId();
        vi.resetModules();
        const again = (await import('./device')).deviceId();

        expect(first).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
        expect(again).toBe(first);
        expect(localStorage.getItem('gesangbuch.geraet')).toBe(first);
    });

    it('replaces a stored one the server would not take', async () => {
        localStorage.setItem('gesangbuch.geraet', 'kurz');

        const id = (await import('./device')).deviceId();

        expect(id).not.toBe('kurz');
        expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    });
});
