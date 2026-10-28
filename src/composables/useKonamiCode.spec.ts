import { describe, expect, it } from 'vitest';

import { endsInKonamiCode } from '@/composables/useKonamiCode';

const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'].concat([
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
]);

describe('endsInKonamiCode', () => {
    it('knows the code', () => {
        expect(endsInKonamiCode(CODE)).toBe(true);
    });

    it('takes B and A with Shift held or Caps Lock on', () => {
        expect(endsInKonamiCode([...CODE.slice(0, -2), 'B', 'A'])).toBe(true);
    });

    it('counts only the keys at the end', () => {
        expect(endsInKonamiCode(['x', 'ArrowUp', ...CODE])).toBe(true);
        expect(endsInKonamiCode([...CODE, 'x'])).toBe(false);
    });

    it('wants all of it', () => {
        expect(endsInKonamiCode(CODE.slice(1))).toBe(false);
    });
});
