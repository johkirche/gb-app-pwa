import { describe, expect, it } from 'vitest';

import {
    type LocalSongStamp,
    type SongManifestEntry,
    buildFileStamps,
    collectReferencedFileIds,
    diffFiles,
    diffSongs,
    findOrphanFileIds,
    latestLocalStamp,
    manifestFiles,
    stampSongs,
} from '@/utils/syncDiff';

function entry(id: string, stamps: Partial<SongManifestEntry> = {}): SongManifestEntry {
    return {
        id,
        dateUpdated: '2026-08-01T10:00:00.000Z',
        textDateUpdated: '2026-06-01T10:00:00.000Z',
        melodieDateUpdated: '2026-06-02T10:00:00.000Z',
        files: [
            { id: `svg-${id}`, modifiedOn: '2026-08-18T13:00:00.000Z' },
            { id: `mxml-${id}`, modifiedOn: '2026-08-23T15:00:00.000Z' },
        ],
        ...stamps,
    };
}

function local(id: string, stamps: Partial<LocalSongStamp> = {}): LocalSongStamp {
    return {
        id,
        dateUpdated: '2026-08-01T10:00:00.000Z',
        textDateUpdated: '2026-06-01T10:00:00.000Z',
        melodieDateUpdated: '2026-06-02T10:00:00.000Z',
        ...stamps,
    };
}

describe('diffSongs', () => {
    it('holt nichts, wenn sich nichts bewegt hat', () => {
        const diff = diffSongs([entry('1'), entry('2')], [local('1'), local('2')]);
        expect(diff).toEqual({ changedIds: [], removedIds: [] });
    });

    it('erkennt eine Änderung am Lied selbst', () => {
        const diff = diffSongs(
            [entry('1', { dateUpdated: '2026-08-23T15:31:00.000Z' })],
            [local('1')],
        );
        expect(diff.changedIds).toEqual(['1']);
    });

    // Der eigentliche Grund für drei Zeitstempel: gesangbuchlied.date_updated
    // bewegt sich nicht, wenn nur der Text oder die Melodie bearbeitet wird.
    it('erkennt eine Änderung am Text', () => {
        const diff = diffSongs(
            [entry('1', { textDateUpdated: '2026-08-23T09:00:00.000Z' })],
            [local('1')],
        );
        expect(diff.changedIds).toEqual(['1']);
    });

    it('erkennt eine Änderung an der Melodie', () => {
        const diff = diffSongs(
            [entry('1', { melodieDateUpdated: '2026-08-23T09:00:00.000Z' })],
            [local('1')],
        );
        expect(diff.changedIds).toEqual(['1']);
    });

    it('holt ein Lied, das lokal noch fehlt', () => {
        const diff = diffSongs([entry('1'), entry('2')], [local('1')]);
        expect(diff.changedIds).toEqual(['2']);
    });

    it('meldet ein Lied, das der Server nicht mehr anbietet', () => {
        const diff = diffSongs([entry('1')], [local('1'), local('353')]);
        expect(diff.removedIds).toEqual(['353']);
        expect(diff.changedIds).toEqual([]);
    });

    // Lieder aus der Zeit vor dem Delta-Sync tragen keine Stempel.
    it('holt ein Lied ohne gespeicherte Zeitstempel einmalig nach', () => {
        const diff = diffSongs([entry('1')], [{ id: '1' }]);
        expect(diff.changedIds).toEqual(['1']);
    });

    it('behandelt null und undefined als dieselbe Aussage', () => {
        const diff = diffSongs(
            [entry('1', { dateUpdated: null, textDateUpdated: null, melodieDateUpdated: null })],
            [{ id: '1' }],
        );
        expect(diff.changedIds).toEqual([]);
    });

    it('holt mit full alles, auch das Unveränderte', () => {
        const diff = diffSongs([entry('1'), entry('2')], [local('1'), local('2')], { full: true });
        expect(diff.changedIds).toEqual(['1', '2']);
    });
});

describe('manifestFiles', () => {
    it('nennt jede Datei einmal, auch bei geteilter Weise', () => {
        const shared = { id: 'svg-geteilt', modifiedOn: '2026-08-18T13:00:00.000Z' };
        const files = manifestFiles([
            entry('1', { files: [shared] }),
            entry('2', { files: [shared] }),
        ]);
        expect(files).toEqual([shared]);
    });
});

describe('diffFiles', () => {
    const manifest = [entry('1')];

    it('lädt, was lokal fehlt', () => {
        expect(diffFiles(manifest, new Set(['svg-1']), {})).toEqual(['mxml-1']);
    });

    it('lädt nichts, was schon da ist', () => {
        expect(diffFiles(manifest, new Set(['svg-1', 'mxml-1']), {})).toEqual([]);
    });

    // Der Regelfall: die Pipeline lädt bei jedem Lauf eine neue Datei hoch,
    // eine bekannte id sind also dieselben Bytes.
    it('vertraut einer bekannten id mit passendem Stempel', () => {
        const stamps = { 'svg-1': '2026-08-18T13:00:00.000Z' };
        expect(diffFiles(manifest, new Set(['svg-1', 'mxml-1']), stamps)).toEqual([]);
    });

    // Der Ausnahmefall: eine Datei, die im Directus-UI ersetzt wurde, behält
    // ihre id.
    it('lädt eine an Ort und Stelle ersetzte Datei erneut', () => {
        const stamps = { 'svg-1': '2026-05-01T13:00:00.000Z' };
        expect(diffFiles(manifest, new Set(['svg-1', 'mxml-1']), stamps)).toEqual(['svg-1']);
    });

    it('hält eine Datei ohne gespeicherten Stempel für aktuell', () => {
        expect(diffFiles(manifest, new Set(['svg-1', 'mxml-1']), { 'svg-1': null })).toEqual([]);
    });

    it('lädt mit full alles', () => {
        expect(diffFiles(manifest, new Set(['svg-1', 'mxml-1']), {}, { full: true })).toHaveLength(
            2,
        );
    });
});

describe('buildFileStamps', () => {
    it('merkt sich nur, was tatsächlich liegt', () => {
        const stamps = buildFileStamps([entry('1')], new Set(['svg-1']));
        expect(stamps).toEqual({ 'svg-1': '2026-08-18T13:00:00.000Z' });
    });

    it('lässt eine fehlgeschlagene Datei aus, damit sie erneut geholt wird', () => {
        expect(buildFileStamps([entry('1')], new Set())).toEqual({});
    });
});

describe('findOrphanFileIds', () => {
    const songs = [
        {
            notentextSvg: { id: 'svg-neu' },
            notentextMxml: { id: 'mxml-1' },
            noten: [{ id: 'raster-1' }],
        },
    ];

    it('räumt die abgelöste Vorgängerdatei weg', () => {
        expect(findOrphanFileIds(['svg-alt', 'svg-neu', 'mxml-1'], songs)).toEqual(['svg-alt']);
    });

    // Ein Raster wird nie synchronisiert, kann aber bei Bedarf geholt worden
    // sein — es hängt am Lied und bleibt.
    it('behält ein bei Bedarf geholtes Raster', () => {
        expect(findOrphanFileIds(['raster-1'], songs)).toEqual([]);
    });

    it('sammelt jede referenzierte id', () => {
        expect(collectReferencedFileIds(songs)).toEqual(new Set(['svg-neu', 'mxml-1', 'raster-1']));
    });
});

describe('stampSongs', () => {
    it('überträgt die Zeitstempel des Manifests auf das geholte Lied', () => {
        const [stamped] = stampSongs([{ id: '1', titel: 'Lied' }], [entry('1')]);
        expect(stamped).toEqual({
            id: '1',
            titel: 'Lied',
            dateUpdated: '2026-08-01T10:00:00.000Z',
            textDateUpdated: '2026-06-01T10:00:00.000Z',
            melodieDateUpdated: '2026-06-02T10:00:00.000Z',
        });
    });

    it('stempelt ein Lied ohne Manifesteintrag leer, statt einen alten Stand zu behalten', () => {
        const [stamped] = stampSongs([{ id: 'fremd' }], [entry('1')]);
        expect(stamped.dateUpdated).toBeNull();
    });
});

describe('latestLocalStamp', () => {
    it('findet den jüngsten Stempel über alle drei Felder', () => {
        const stamp = latestLocalStamp([
            local('1'),
            local('2', { textDateUpdated: '2026-08-23T15:31:00.000Z' }),
        ]);
        expect(stamp).toBe('2026-08-23T15:31:00.000Z');
    });

    it('sagt nichts, wenn nichts gespeichert ist', () => {
        expect(latestLocalStamp([{ id: '1' }])).toBeNull();
        expect(latestLocalStamp([])).toBeNull();
    });
});
