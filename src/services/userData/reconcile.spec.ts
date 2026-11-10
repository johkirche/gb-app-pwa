import { describe, expect, it } from 'vitest';

import type { Synced } from '@/db';

import { reconcile } from './reconcile';

type Row = Synced & { id: string; value: string; snippet?: string };

const EARLY = '2026-11-01T10:00:00.000Z';
const LATE = '2026-11-02T10:00:00.000Z';

function row(id: string, value: string, sync: Partial<Synced> = {}): Row {
    return {
        id,
        value,
        dirty: 0,
        deleted: 0,
        synced: 1,
        createdAt: EARLY,
        updatedAt: EARLY,
        ...sync,
    };
}

const same = (a: Row, b: Row) => a.value === b.value;
const run = (local: Row[], server: Row[]) => reconcile(local, server, { same });

describe('reconcile', () => {
    it('takes a row only the server has: new from another device', () => {
        expect(run([], [row('a', 'x')])).toEqual({ put: [row('a', 'x')], remove: [] });
    });

    it('takes the server’s row over an unchanged one', () => {
        const server = row('a', 'new', { updatedAt: LATE });
        expect(run([row('a', 'old')], [server]).put).toEqual([server]);
    });

    it('leaves an unchanged row alone when nothing moved', () => {
        expect(run([row('a', 'x')], [row('a', 'x')])).toEqual({ put: [], remove: [] });
    });

    it('keeps a change made here when it is the later one', () => {
        const local = row('a', 'mine', { dirty: 1, updatedAt: LATE });
        expect(run([local], [row('a', 'theirs')])).toEqual({ put: [], remove: [] });
    });

    it('gives way to a later change on the server', () => {
        const server = row('a', 'theirs', { updatedAt: LATE });
        expect(run([row('a', 'mine', { dirty: 1 })], [server]).put).toEqual([server]);
    });

    it('counts the same content as settled, whoever was first', () => {
        const server = row('a', 'x', { updatedAt: EARLY });
        expect(run([row('a', 'x', { dirty: 1, updatedAt: LATE })], [server]).put).toEqual([server]);
    });

    it('uploads a row the server never had', () => {
        expect(run([row('a', 'x', { dirty: 1, synced: 0 })], [])).toEqual({ put: [], remove: [] });
    });

    it('drops a row deleted on another device', () => {
        expect(run([row('a', 'x')], [])).toEqual({ put: [], remove: ['a'] });
    });

    it('drops a tombstone once the server has deleted the row too', () => {
        expect(run([row('a', 'x', { dirty: 1, deleted: 1 })], []).remove).toEqual(['a']);
    });

    it('keeps a deletion here unless the row was changed elsewhere since', () => {
        const tombstone = row('a', 'x', { dirty: 1, deleted: 1, updatedAt: LATE });
        expect(run([tombstone], [row('a', 'x')])).toEqual({ put: [], remove: [] });

        const editedLater = row('a', 'y', { updatedAt: '2026-11-03T10:00:00.000Z' });
        expect(run([tombstone], [editedLater]).put).toEqual([editedLater]);
    });

    it('keeps a change to a row deleted elsewhere, and uploads it afresh', () => {
        const local = row('a', 'mine', { dirty: 1, updatedAt: LATE });
        expect(run([local], []).put).toEqual([{ ...local, synced: 0 }]);
    });

    it('turns its own upload of a derived id into an update when another device was first', () => {
        const local = row('a', 'mine', { dirty: 1, synced: 0, updatedAt: LATE });
        expect(run([local], [row('a', 'theirs')]).put).toEqual([{ ...local, synced: 1 }]);
    });

    it('carries device-only fields over', () => {
        const local = { ...row('a', 'old'), snippet: 'Der HERR ist mein Hirt' };
        const result = reconcile([local], [row('a', 'new', { updatedAt: LATE })], {
            same,
            carry: (s, l) => ({ ...s, snippet: l.snippet }),
        });
        expect(result.put[0]).toMatchObject({ value: 'new', snippet: 'Der HERR ist mein Hirt' });
    });
});
