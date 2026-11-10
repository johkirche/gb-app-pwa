import { describe, expect, it } from 'vitest';

import { assignPositions, comparePositions, positionAfter } from './positions';

function ordered(ids: string[], positions: Map<string, string>): string[] {
    return [...ids].sort((a, b) => comparePositions(positions.get(a)!, positions.get(b)!));
}

describe('assignPositions', () => {
    it('numbers a new list in order', () => {
        const positions = assignPositions(['a', 'b', 'c'], new Map());
        expect(ordered(['c', 'a', 'b'], positions)).toEqual(['a', 'b', 'c']);
    });

    it('moves only what moved', () => {
        const before = new Map([
            ['a', 'a0'],
            ['b', 'a1'],
            ['c', 'a2'],
        ]);
        const after = assignPositions(['a', 'c', 'b'], before);
        expect(after.get('a')).toBe('a0');
        expect(ordered(['a', 'b', 'c'], after)).toEqual(['a', 'c', 'b']);
        expect([...after].filter(([id, p]) => before.get(id) !== p).map(([id]) => id)).toEqual([
            'c',
            'b',
        ]);
    });

    it('fits a new entry between its neighbours without touching them', () => {
        const before = new Map([
            ['a', 'a0'],
            ['c', 'a1'],
        ]);
        const after = assignPositions(['a', 'b', 'c'], before);
        expect(after.get('a')).toBe('a0');
        expect(after.get('c')).toBe('a1');
        expect(ordered(['a', 'b', 'c'], after)).toEqual(['a', 'b', 'c']);
    });

    it('numbers a list afresh where two devices picked the same key', () => {
        const before = new Map([
            ['a', 'a0'],
            ['b', 'a1'],
            ['c', 'a1'],
        ]);
        const after = assignPositions(['a', 'b', 'x', 'c'], before);
        expect(new Set(after.values()).size).toBe(4);
        expect(ordered(['c', 'x', 'b', 'a'], after)).toEqual(['a', 'b', 'x', 'c']);
    });

    it('appends after the last key', () => {
        expect(comparePositions(positionAfter('a5'), 'a5')).toBe(1);
        expect(positionAfter(null)).toBe('a0');
    });
});
