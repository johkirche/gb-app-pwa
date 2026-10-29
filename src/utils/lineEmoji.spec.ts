import { describe, expect, it } from 'vitest';

import { lineEmoji } from './lineEmoji';

describe('lineEmoji', () => {
    it('drops the colour-presentation selector', () => {
        expect(lineEmoji('🕊️')).toBe('🕊');
        expect(lineEmoji('✝️')).toBe('✝');
    });

    it('leaves emoji without a selector alone', () => {
        expect(lineEmoji('🎵')).toBe('🎵');
    });

    it('keeps ZWJ sequences joined', () => {
        expect(lineEmoji('🧑‍🤝‍🧑')).toBe('🧑‍🤝‍🧑');
        expect(lineEmoji('👨‍👩‍👧‍👦')).toBe('👨‍👩‍👧‍👦');
    });
});
