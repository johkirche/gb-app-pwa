import { describe, expect, it } from 'vitest';

import { mayUseMobileData } from '@/utils/mobileData';

const finger = { matchMedia: () => ({ matches: true }) } as unknown as Window;
const mouse = { matchMedia: () => ({ matches: false }) } as unknown as Window;

function on(type?: string) {
    return (type ? { connection: { type } } : {}) as unknown as Navigator;
}

describe('mayUseMobileData', () => {
    it('fragt am Schreibtisch nie, was auch immer die Verbindung meldet', () => {
        expect(mayUseMobileData(on(), mouse)).toBe(false);
        expect(mayUseMobileData(on('cellular'), mouse)).toBe(false);
    });

    it('nimmt am Handy ohne Auskunft Mobilfunk an (iOS)', () => {
        expect(mayUseMobileData(on(), finger)).toBe(true);
        expect(mayUseMobileData(on('unknown'), finger)).toBe(true);
    });

    it('lässt WLAN und Kabel gelten, wo der Browser sie nennt (Android)', () => {
        expect(mayUseMobileData(on('wifi'), finger)).toBe(false);
        expect(mayUseMobileData(on('ethernet'), finger)).toBe(false);
        expect(mayUseMobileData(on('cellular'), finger)).toBe(true);
    });
});
