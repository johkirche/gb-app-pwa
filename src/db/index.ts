import Dexie, { Table } from 'dexie';

// Type definitions based on GraphQL schema
export interface Autor {
    vorname: string;
    nachname: string;
    sterbejahr?: number | null;
    geburtsjahr?: number | null;
    geburtsjahrePrefix?: string | null;
    sterbejahrPrefix?: string | null;
    autorPrefix?: string | null;
    autorSuffix?: string | null;
    ursprungsAutorObj?: Autor | null;
}

export interface NotenFile {
    filename_download: string;
    id: string;
    blob?: Blob; // Store the actual file data
}

export interface Category {
    index: string;
    name: string;
}

export interface Strophe {
    text?:
        | {
              text: string;
              strophe: string;
              aenderungsvorschlag?: string | null;
              anmerkung?: string | null;
          }
        | string;
    strophe: string;
    aenderungsvorschlag?: string | null;
    anmerkung?: string | null;
}

export interface Song {
    id: string;
    index: number;
    titel: string;
    strophen: Strophe[];
    textAutoren: Autor[];
    melodieAutoren: Autor[];
    noten: NotenFile[];
    notentextMxml: NotenFile | null;
    // Vector Notenbild (Directus `gesangbuchlied.notentext_svg`) — the source of
    // the Notenbild view. Optional so songs stored before this field was synced
    // stay valid; those fall back to the raster files in `noten`.
    notentextSvg?: NotenFile | null;
    kategorien: Category[];
    // Urheberangaben (Dashboard-kompatibel, Issue #18) — optional, damit vor
    // dem nächsten Sync gespeicherte Lieder weiterhin gültig bleiben.
    copyright?: string | null;
    textCopyright?: string | null;
    melodieCopyright?: string | null;
    textAutorExtraSuffix?: string | null;
    melodieAutorExtraSuffix?: string | null;
    // Die Weise des Liedes (Directus-Collection `melodie`). Rund die Hälfte des
    // Bestands teilt sich eine Weise mit mindestens einem anderen Lied, deshalb
    // sitzt die Nummer an der Melodie und nicht am Lied: `choralbuchNummer` ist
    // im Druck die kleinere Zahl unter der Liednummer und verweist aufs
    // Choralbuch. Vergeben wird sie im Dashboard (Nummerngenerierung),
    // alphabetisch nach Melodietitel über alle angenommenen Lieder.
    //
    // Optional, damit vor dem nächsten Sync gespeicherte Lieder gültig bleiben.
    melodieId?: string | null;
    melodieTitel?: string | null;
    choralbuchNummer?: number | null;
    // Die serverseitigen Zeitstempel der drei Collections, aus denen ein Lied
    // besteht, wie sie beim letzten Sync galten. Der Sync vergleicht sie gegen
    // das Manifest und holt nur, was sich bewegt hat (src/utils/syncDiff.ts).
    //
    // Optional, damit vor dem Delta-Sync gespeicherte Lieder gültig bleiben —
    // die vergleichen sich als ungleich und werden einmalig nachgeladen.
    dateUpdated?: string | null;
    textDateUpdated?: string | null;
    melodieDateUpdated?: string | null;
}

// Auth related types
export interface AuthData {
    id: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

export interface UserData {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    activated: boolean;
}

// Sync/app metadata as simple key-value rows (e.g. lastSyncTime, lastServerUpdate)
export interface MetaEntry {
    key: string;
    value: string;
}

// Playlist types
export interface Playlist {
    id: string;
    name: string;
    emoji: string;
    songIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

// Preferences types

/**
 * @deprecated The melody is the book's own engraving now, and the re-set
 * notation is only reached by zooming past the fit width — see
 * NotationBeyondFit. Read once on load to carry an existing setting over.
 */
export type MelodyDisplayMode = 'image' | 'xml';

/**
 * What the melody becomes once it has been enlarged past the width the page can
 * show — the only point at which the two renderings are both defensible.
 *
 * - 'engraving' keeps the book's own setting, pushed sideways
 * - 'reflow' hands the song to the re-set notation, which breaks the systems
 *   onto the width there is
 *
 * Below the fit width there is nothing to decide and this is not consulted.
 */
export type NotationBeyondFit = 'engraving' | 'reflow';

export interface XmlDisplaySettings {
    showMeasureNumbers: boolean;
    showLyrics: boolean;
    /** Colour the sounding note and its syllable while a song plays */
    highlightNotes: boolean;
    /** Show the band and the line that sweep the staff while a song plays */
    showPlayhead: boolean;
}

/**
 * When the Gottesdienst tab is offered: 'auto' only while songs are marked for
 * one, 'always' pinned in the tab bar.
 */
export type ServiceTabMode = 'auto' | 'always';

export interface PreferencesData {
    id: string;
    /**
     * One size for the whole song page (0.5–2.0). The verses are set at the
     * notation's own size, so scaling them apart was never meaningful — this
     * scales the page the two share.
     */
    pageScale?: number;
    /** @deprecated Read once on load to carry an existing setting over to pageScale. */
    notationScale?: number;
    /** @deprecated Read once on load to carry an existing setting over to pageScale. */
    textSize?: 'small' | 'medium' | 'large' | 'xlarge';
    /** @deprecated Read once on load to carry an existing setting over to notationBeyondFit. */
    melodyDisplayMode?: MelodyDisplayMode;
    /**
     * Undefined until the reader has actually been asked — which only happens
     * by enlarging a song past the fit width. Until then the default holds and
     * the setting is not shown anywhere, because there is nothing it would
     * change; once chosen it appears in Einstellungen, so it can be found again
     * without zooming back in to look for it.
     */
    notationBeyondFit?: NotationBeyondFit;
    xmlSettings?: XmlDisplaySettings;
    /** Optional so records stored before the Gottesdienst tab existed stay valid. */
    serviceTab?: ServiceTabMode;
    /**
     * Hold a screen wake lock while a song is open, so the page does not dim
     * mid-verse. Optional so records stored before it existed stay valid; the
     * store supplies the default.
     */
    keepScreenAwake?: boolean;
    /**
     * Play through a connected MIDI instrument instead of the built-in
     * soundfont. Off by default and deliberately so: since Chrome 124 the first
     * Web MIDI call raises a permission prompt, which nobody should meet
     * unasked.
     */
    midiOutputEnabled?: boolean;
    /** Which MIDI output was chosen. Empty means "the only one connected". */
    midiOutputId?: string;
}

// Favorites: id == song id
export interface Favorite {
    id: string;
    createdAt: Date;
}

// --- Gottesdienst (temporary service selection) ---

/**
 * Where a plan came from, when it was not assembled on this device.
 *
 * The app only ever writes the built-in providers today (see
 * `src/services/servicePlans`), but the shape is deliberately provider-agnostic:
 * a Directus-published order of service is adopted through the same field, so a
 * plan can later be refreshed from — or matched against — its source.
 */
export interface ServicePlanOrigin {
    /** Id of the provider that offered the plan ('playlist', later e.g. 'directus'). */
    providerId: string;
    /** The id that provider knows the offer by. */
    offerId: string;
    /** What the provider called it when it was adopted. */
    label?: string | null;
    fetchedAt: Date;
}

/**
 * One song on the plan. An object rather than a bare id so the
 * Gottesdienst-Modus (#32) can hang per-entry verses, tempo and key off it
 * without another migration.
 */
export interface ServiceEntry {
    songId: string;
    /** Free note for the entry, e.g. "Eingangslied". */
    note?: string | null;
}

/** The songs marked for one service. Temporary by design: it expires by itself. */
export interface ServicePlan {
    id: string;
    title: string;
    /** The day the service is held — ISO `yyyy-mm-dd` in local time. */
    date: string;
    entries: ServiceEntry[];
    /** Epoch ms after which the plan is dropped without asking (end of `date`). */
    expiresAt: number;
    /** Unset for a selection made here; set when adopted from a provider. */
    origin?: ServicePlanOrigin | null;
    createdAt: Date;
    updatedAt: Date;
}

// Dexie database class
export class GesangbuchDatabase extends Dexie {
    songs!: Table<Song, string>;
    files!: Table<{ id: string; blob: Blob; filename: string }, string>;
    auth!: Table<AuthData, string>;
    users!: Table<UserData, string>;
    playlists!: Table<Playlist, string>;
    preferences!: Table<PreferencesData, string>;
    favorites!: Table<Favorite, string>;
    services!: Table<ServicePlan, string>;
    meta!: Table<MetaEntry, string>;

    constructor() {
        super('GesangbuchDB');

        this.version(1).stores({
            songs: 'id, titel',
            files: 'id, filename',
        });

        // Version 2: Add auth and users tables
        this.version(2).stores({
            songs: 'id, titel',
            files: 'id, filename',
            auth: 'id',
            users: 'id, email, role',
        });

        // Version 3: Add playlists table
        this.version(3).stores({
            songs: 'id, titel',
            files: 'id, filename',
            auth: 'id',
            users: 'id, email, role',
            playlists: 'id, name, createdAt',
        });

        // Version 4: Add preferences table
        this.version(4).stores({
            songs: 'id, titel',
            files: 'id, filename',
            auth: 'id',
            users: 'id, email, role',
            playlists: 'id, name, createdAt',
            preferences: 'id',
        });

        // Version 5: Add favorites table
        this.version(5).stores({
            songs: 'id, titel',
            files: 'id, filename',
            auth: 'id',
            users: 'id, email, role',
            playlists: 'id, name, createdAt',
            preferences: 'id',
            favorites: 'id, createdAt',
        });

        // Version 6: Add meta table; purge persisted dev skip-auth records
        // (the dev bypass is in-memory only now and must not survive in IndexedDB)
        this.version(6)
            .stores({
                songs: 'id, titel',
                files: 'id, filename',
                auth: 'id',
                users: 'id, email, role',
                playlists: 'id, name, createdAt',
                preferences: 'id',
                favorites: 'id, createdAt',
                meta: 'key',
            })
            .upgrade((tx) =>
                tx
                    .table('users')
                    .filter((u) => u.skipAuth === true || u.id === 'guest')
                    .delete(),
            );

        // Version 7: Add services table (the temporary Gottesdienst selection).
        // Indexed by expiry so pruning does not have to read every row.
        this.version(7).stores({
            songs: 'id, titel',
            files: 'id, filename',
            auth: 'id',
            users: 'id, email, role',
            playlists: 'id, name, createdAt',
            preferences: 'id',
            favorites: 'id, createdAt',
            meta: 'key',
            services: 'id, date, expiresAt',
        });

        // Version 8: no schema change — drop the `lastServerUpdate` watermark.
        // The delta sync compares per-song timestamps against the manifest
        // instead of one collection-wide mark (src/utils/syncDiff.ts), so the
        // row is dead. Leaving it would only invite a future reader to trust it.
        this.version(8)
            .stores({
                songs: 'id, titel',
                files: 'id, filename',
                auth: 'id',
                users: 'id, email, role',
                playlists: 'id, name, createdAt',
                preferences: 'id',
                favorites: 'id, createdAt',
                meta: 'key',
                services: 'id, date, expiresAt',
            })
            .upgrade((tx) => tx.table('meta').delete('lastServerUpdate'));
    }
}

// Export singleton instance
export const db = new GesangbuchDatabase();
