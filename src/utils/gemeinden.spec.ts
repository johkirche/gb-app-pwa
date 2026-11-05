import { describe, expect, it } from 'vitest';

import {
    type GemeindeRow,
    MAP_HEIGHT,
    MAP_WIDTH,
    cameraOn,
    germanyPath,
    listProgress,
    scrollTopAt,
    stepCamera,
    toGemeinden,
    viewBoxOf,
} from '@/utils/gemeinden';

function row(name: string, city: string | null, position: [number, number] | null): GemeindeRow {
    return {
        id: name,
        name,
        city,
        coordinates: position && { coordinates: position },
    };
}

// As the collection holds them, for the places the map has to get right: its
// furthest corners, and a place in the crowd around Berlin.
const RIEHEN = row('Baden-Baden', 'Riehen', [7.64968, 47.58469]);
const GUESTROW = row('Güstrow', 'Güstrow', [12.1806, 53.7836]);
const POTSDAM = row('Potsdam', 'Potsdam', [13.0925, 52.3796]);
const MICHAELS = row('Berlin St.-Michaels-Heim', 'Berlin', [13.2772, 52.4883]);
const BREMEN = row('Bremen', 'Bremen', [8.7893, 53.1052]);

describe('toGemeinden', () => {
    it('names the place only where the name does not', () => {
        const [baden, michaels, bremen] = toGemeinden([RIEHEN, MICHAELS, BREMEN]);
        expect(baden.place).toBe('Riehen');
        expect(michaels.place).toBeNull();
        expect(bremen.place).toBeNull();
    });

    it('does not repeat a place the name spells differently', () => {
        const [gemeinde] = toGemeinden([row('Schwedt (Oder)', 'Schwedt/Oder', null)]);
        expect(gemeinde.place).toBeNull();
    });

    it('leaves a row without coordinates off the map, and on the list', () => {
        const [gemeinde] = toGemeinden([row('Neu', 'Neustadt', null)]);
        expect(gemeinde.point).toBeNull();
        expect(gemeinde.place).toBe('Neustadt');
    });

    it('does not take a malformed point for a place', () => {
        const [gemeinde] = toGemeinden([{ id: 'x', name: 'X', coordinates: { coordinates: 'x' } }]);
        expect(gemeinde.point).toBeNull();
    });

    it('fits every Gemeinde inside the map, Riehen and Güstrow at its ends', () => {
        for (const { point } of toGemeinden([RIEHEN, GUESTROW, POTSDAM, BREMEN])) {
            expect(point!.x).toBeGreaterThan(0);
            expect(point!.x).toBeLessThan(MAP_WIDTH);
            expect(point!.y).toBeGreaterThan(0);
            expect(point!.y).toBeLessThan(MAP_HEIGHT);
        }
    });

    it('puts north up and east to the right', () => {
        const [riehen, guestrow] = toGemeinden([RIEHEN, GUESTROW]);
        expect(guestrow.point!.y).toBeLessThan(riehen.point!.y);
        expect(guestrow.point!.x).toBeGreaterThan(riehen.point!.x);
    });
});

describe('cameraOn', () => {
    it('shows the whole country when the list is on no Gemeinde', () => {
        expect(viewBoxOf(cameraOn(null))).toBe(`0.0 0.0 ${MAP_WIDTH}.0 ${MAP_HEIGHT}.0`);
    });

    it('closes in on a Gemeinde', () => {
        const [potsdam] = toGemeinden([POTSDAM]);
        const camera = cameraOn(potsdam.point);
        expect(camera.zoom).toBeGreaterThan(1);
        expect(camera.x).toBe(potsdam.point!.x);
        expect(camera.y).toBe(potsdam.point!.y);
    });

    it('stays inside the map at its edge, with the Gemeinde still in the frame', () => {
        const [riehen] = toGemeinden([RIEHEN]);
        const [left, top, width, height] = viewBoxOf(cameraOn(riehen.point)).split(' ').map(Number);
        expect(top + height).toBeLessThanOrEqual(MAP_HEIGHT + 0.1);
        expect(riehen.point!.y).toBeGreaterThan(top);
        expect(riehen.point!.y).toBeLessThan(top + height);
        expect(riehen.point!.x).toBeGreaterThan(left);
        expect(riehen.point!.x).toBeLessThan(left + width);
    });
});

describe('stepCamera', () => {
    const [potsdam] = toGemeinden([POTSDAM]);
    const whole = cameraOn(null);
    const close = cameraOn(potsdam.point);

    it('moves part of the way, not past it', () => {
        const next = stepCamera(whole, close, 16);
        expect(next.zoom).toBeGreaterThan(whole.zoom);
        expect(next.zoom).toBeLessThan(close.zoom);
        expect(next.x).toBeGreaterThan(whole.x);
        expect(next.x).toBeLessThan(close.x);
    });

    it('moves alike however the time is cut up', () => {
        const once = stepCamera(whole, close, 32);
        const twice = stepCamera(stepCamera(whole, close, 16), close, 16);
        expect(twice.x).toBeCloseTo(once.x, 6);
        expect(twice.zoom).toBeCloseTo(once.zoom, 6);
    });

    it('hands back the target on arrival, so the animation can stop', () => {
        let camera = whole;
        for (let frame = 0; frame < 200 && camera !== close; frame++) {
            camera = stepCamera(camera, close, 16);
        }
        expect(camera).toBe(close);
    });
});

describe('listProgress', () => {
    it('stands at the start until the rows reach the map', () => {
        expect(listProgress(0, 200, 1400)).toBe(0);
        expect(listProgress(200, 200, 1400)).toBe(0);
    });

    it('runs through the scroll', () => {
        expect(listProgress(500, 200, 1400)).toBeCloseTo(0.25);
    });

    it('reaches the end with the scroll, the last row included', () => {
        expect(listProgress(1400, 200, 1400)).toBe(1);
        // A bounce past the end, as a phone's overscroll reports it.
        expect(listProgress(1430, 200, 1400)).toBe(1);
    });

    it('stays at the start for a list too short to scroll', () => {
        expect(listProgress(0, 300, 40)).toBe(0);
    });
});

describe('scrollTopAt', () => {
    it('finds the way back, so a row brought into place is the one chosen', () => {
        for (const progress of [0, 0.1, 0.5, 0.93, 1]) {
            expect(listProgress(scrollTopAt(progress, 200, 1400), 200, 1400)).toBeCloseTo(progress);
        }
    });
});

describe('germanyPath', () => {
    it('is one closed shape inside the map', () => {
        const path = germanyPath();
        expect(path).toMatch(/^M[\d. ]+(L[\d. ]+)+Z$/);
        const numbers = path.match(/[\d.]+/g)!.map(Number);
        const xs = numbers.filter((_, index) => index % 2 === 0);
        const ys = numbers.filter((_, index) => index % 2 === 1);
        expect(Math.max(...xs)).toBeLessThan(MAP_WIDTH);
        expect(Math.max(...ys)).toBeLessThan(MAP_HEIGHT);
    });
});
