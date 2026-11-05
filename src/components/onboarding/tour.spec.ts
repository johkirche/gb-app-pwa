import { describe, expect, it } from 'vitest';

import { tourSlides } from './tour';

function device({ coarse = false, preview = false }) {
    return {
        matchMedia: () => ({ matches: coarse }),
        document: { documentElement: { classList: { contains: () => preview } } },
    } as unknown as Window;
}

const finger = device({ coarse: true });
const mouse = device({});

function menuSlide(win: Window) {
    const slide = tourSlides(win).find((s) => s.kind === 'gedrueckt');
    if (!slide) throw new Error('no gedrueckt slide');
    return slide;
}

describe('the tour, by device', () => {
    it('tells a finger about the long press and nothing about a mouse', () => {
        const slide = menuSlide(finger);
        expect(slide.title).toBe('Gedrückt halten');
        expect(slide.text).toContain('mit dem Finger');
        expect(slide.text).not.toMatch(/Maustaste|Rechtsklick|Computer/);
    });

    it('tells a mouse about the right click, and that a phone does it differently', () => {
        const slide = menuSlide(mouse);
        expect(slide.title).toBe('Rechtsklick');
        expect(slide.text).toContain('rechten Maustaste');
        expect(slide.text).toContain('Auf dem Handy');
    });

    it('treats the dev phone preview as a finger, where a held button long-presses', () => {
        expect(menuSlide(device({ preview: true })).title).toBe('Gedrückt halten');
    });

    it('shows the same slides in the same order either way', () => {
        const kinds = (win: Window) => tourSlides(win).map((s) => s.kind);
        expect(kinds(mouse)).toEqual(kinds(finger));
    });
});
