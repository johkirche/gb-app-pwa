import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { neighboursIn, useNavigationContextStore } from '@/stores/navigationContext';

describe('neighboursIn (Issue #34)', () => {
    const ids = ['a', 'b', 'c', 'd'];

    it('nennt die Nachbarn in der Reihenfolge der Liste', () => {
        expect(neighboursIn(ids, 'b')).toEqual({
            prevId: 'a',
            nextId: 'c',
            position: 2,
            total: 4,
        });
    });

    it('hat am Anfang kein Zurück und am Ende kein Vor', () => {
        expect(neighboursIn(ids, 'a')).toMatchObject({ prevId: null, nextId: 'b', position: 1 });
        expect(neighboursIn(ids, 'd')).toMatchObject({ prevId: 'c', nextId: null, position: 4 });
    });

    it('weiß nichts über ein Lied, das nicht in der Liste steht', () => {
        expect(neighboursIn(ids, 'x')).toEqual({
            prevId: null,
            nextId: null,
            position: 0,
            total: 4,
        });
    });

    it('geht bei einem doppelt eingetragenen Lied von der ersten Zeile aus', () => {
        expect(neighboursIn(['a', 'b', 'a', 'c'], 'a')).toMatchObject({
            prevId: null,
            nextId: 'b',
            position: 1,
        });
    });

    it('bleibt bei einer Liste mit einem Lied stehen', () => {
        expect(neighboursIn(['only'], 'only')).toEqual({
            prevId: null,
            nextId: null,
            position: 1,
            total: 1,
        });
    });
});

describe('useNavigationContextStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('beginnt ohne Kontext', () => {
        const store = useNavigationContextStore();
        expect(store.hasContext).toBe(false);
        expect(store.context).toBeNull();
    });

    it('behält, was die Liste auf dem Weg ins Lied übergibt', () => {
        const store = useNavigationContextStore();
        store.setContext({ kind: 'playlist', label: 'Advent', songIds: ['a', 'b', 'c'] });

        expect(store.hasContext).toBe(true);
        expect(store.context).toEqual({
            kind: 'playlist',
            label: 'Advent',
            songIds: ['a', 'b', 'c'],
        });
    });

    it('kopiert die Reihenfolge, statt an der Liste zu hängen', () => {
        const store = useNavigationContextStore();
        const ids = ['a', 'b'];
        store.setContext({ kind: 'list', label: 'Liederliste', songIds: ids });
        ids.push('c');

        expect(store.context?.songIds).toEqual(['a', 'b']);
    });

    it('lässt sich leeren', () => {
        const store = useNavigationContextStore();
        store.setContext({ kind: 'service', label: 'Gottesdienst', songIds: ['a'] });
        store.clear();

        expect(store.hasContext).toBe(false);
        expect(store.context).toBeNull();
    });
});
