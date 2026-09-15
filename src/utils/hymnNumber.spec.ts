import { describe, expect, it } from 'vitest';

import type { Song } from '@/db';
import { hymnLink, hymnPath, parseHymnNumber, songByNumber } from '@/utils/hymnNumber';

function song(index: number, id = `id-${index}`): Song {
    return {
        id,
        index,
        titel: `Lied ${index}`,
        strophen: [],
        textAutoren: [],
        melodieAutoren: [],
        noten: [],
        notentextMxml: null,
        kategorien: [],
    };
}

describe('parseHymnNumber (Issue #34)', () => {
    it('liest eine schlichte Liednummer', () => {
        expect(parseHymnNumber('122')).toBe(122);
        expect(parseHymnNumber('1')).toBe(1);
    });

    it('nimmt bei einem Array den ersten Wert', () => {
        expect(parseHymnNumber(['7', '8'])).toBe(7);
    });

    it('weist alles zurück, was keine Nummer aus dem Buch ist', () => {
        expect(parseHymnNumber('0')).toBeNull();
        expect(parseHymnNumber('0122')).toBeNull();
        expect(parseHymnNumber('12.5')).toBeNull();
        expect(parseHymnNumber('-3')).toBeNull();
        expect(parseHymnNumber('abc')).toBeNull();
        expect(parseHymnNumber('')).toBeNull();
        expect(parseHymnNumber(undefined)).toBeNull();
        expect(parseHymnNumber(null)).toBeNull();
    });
});

describe('songByNumber', () => {
    const songs = [song(3), song(1), song(122)];

    it('findet das Lied unter seiner Nummer', () => {
        expect(songByNumber(songs, '122')?.id).toBe('id-122');
        expect(songByNumber(songs, 1)?.id).toBe('id-1');
    });

    it('gibt null zurück, wo das Buch keine solche Nummer hat', () => {
        expect(songByNumber(songs, '2')).toBeNull();
        expect(songByNumber(songs, 'x')).toBeNull();
        expect(songByNumber(songs, 0)).toBeNull();
        expect(songByNumber([], '1')).toBeNull();
    });
});

describe('hymnLink', () => {
    it('teilt ein Lied unter seiner Nummer', () => {
        expect(hymnPath(song(122))).toBe('/lied/122');
        expect(hymnLink(song(122), 'https://gesangbuch.example')).toBe(
            'https://gesangbuch.example/lied/122',
        );
    });

    it('fällt ohne Nummer auf die Kennung zurück', () => {
        expect(hymnPath(song(0, 'abc'))).toBe('/songs/abc');
    });

    it('verträgt einen Origin mit Schrägstrich am Ende', () => {
        expect(hymnLink(song(5), 'https://gesangbuch.example/')).toBe(
            'https://gesangbuch.example/lied/5',
        );
    });
});
