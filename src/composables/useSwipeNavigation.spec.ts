import { describe, expect, it } from 'vitest';

import { classifySwipe, startsInHorizontalScroller } from '@/composables/useSwipeNavigation';

const at = (x: number, y: number, time = 0) => ({ x, y, time });

describe('classifySwipe (Issue #34)', () => {
    it('liest einen schnellen Zug nach links als „nächstes"', () => {
        expect(classifySwipe(at(300, 200), at(150, 210, 200))).toBe('left');
    });

    it('liest einen schnellen Zug nach rechts als „vorheriges"', () => {
        expect(classifySwipe(at(100, 200), at(260, 190, 200))).toBe('right');
    });

    it('lässt einen kurzen Wischer durchgehen', () => {
        expect(classifySwipe(at(100, 200), at(140, 200, 100))).toBeNull();
    });

    it('hält senkrechtes Scrollen mit etwas Schräge nicht für ein Blättern', () => {
        expect(classifySwipe(at(100, 100), at(180, 300, 200))).toBeNull();
    });

    it('verlangt eine klare Richtung, nicht bloß mehr breit als hoch', () => {
        // 100 px wide, 80 px tall: wider than tall, but not clearly so
        expect(classifySwipe(at(0, 0), at(100, 80, 200))).toBeNull();
    });

    it('zählt ein langsames Ziehen nicht', () => {
        expect(classifySwipe(at(300, 200), at(100, 200, 1500))).toBeNull();
    });

    it('lässt die Schwellen einstellen', () => {
        expect(
            classifySwipe(at(0, 0), at(30, 0, 100), {
                minDistance: 20,
                minRatio: 1,
                maxDuration: 200,
            }),
        ).toBe('right');
    });
});

describe('startsInHorizontalScroller', () => {
    function scroller(overflowX: string, wide: boolean): HTMLElement {
        const el = document.createElement('div');
        el.style.overflowX = overflowX;
        Object.defineProperty(el, 'scrollWidth', { value: wide ? 800 : 300 });
        Object.defineProperty(el, 'clientWidth', { value: 300 });
        return el;
    }

    it('erkennt einen Start in einer seitlich scrollbaren Notenbox', () => {
        const page = document.createElement('main');
        const box = scroller('auto', true);
        const inner = document.createElement('span');
        box.append(inner);
        page.append(box);

        expect(startsInHorizontalScroller(inner, page)).toBe(true);
    });

    it('lässt eine Box durch, die zwar overflow-x hat, aber nicht überläuft', () => {
        const page = document.createElement('main');
        const box = scroller('auto', false);
        page.append(box);

        expect(startsInHorizontalScroller(box, page)).toBe(false);
    });

    it('lässt eine breite Box durch, die nicht scrollen darf', () => {
        const page = document.createElement('main');
        const box = scroller('hidden', true);
        page.append(box);

        expect(startsInHorizontalScroller(box, page)).toBe(false);
    });

    it('schaut nicht über die Wischfläche hinaus', () => {
        const outer = scroller('auto', true);
        const page = document.createElement('main');
        const text = document.createElement('p');
        page.append(text);
        outer.append(page);

        expect(startsInHorizontalScroller(text, page)).toBe(false);
    });

    it('verträgt ein Ziel, das kein Element ist', () => {
        const page = document.createElement('main');
        expect(startsInHorizontalScroller(null, page)).toBe(false);
    });
});
