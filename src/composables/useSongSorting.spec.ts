import { describe, expect, it } from 'vitest';

import { indexLetter } from '@/composables/useSongSorting';

describe('indexLetter (Issue #28)', () => {
    it('führt Umlaute bei ihrem Grundbuchstaben', () => {
        expect(indexLetter('Ändere mich')).toBe('A');
        expect(indexLetter('Öffne mir die Augen')).toBe('O');
        expect(indexLetter('Über allem steht der Herr')).toBe('U');
    });

    it('sortiert ß wie S', () => {
        expect(indexLetter('ßonderfall')).toBe('S');
    });

    it('bleibt bei den übrigen Buchstaben', () => {
        expect(indexLetter('Großer Gott, wir loben dich')).toBe('G');
        expect(indexLetter('  Wachet auf')).toBe('W');
        expect(indexLetter('mein Heiland')).toBe('M');
    });

    it('sammelt alles andere unter #', () => {
        expect(indexLetter('1. Advent')).toBe('#');
        expect(indexLetter('„Kommt her zu mir"')).toBe('#');
        expect(indexLetter('')).toBe('#');
    });
});
