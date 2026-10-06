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
    // Der Liedtext (Directus-Collection `text`), auf den die Bibelstellen
    // verweisen (src/utils/bibelstellen.ts) — sie hängen am Text, nicht am Lied.
    // Optional, damit vor dem nächsten Sync gespeicherte Lieder gültig bleiben;
    // die finden ihre Stellen bis dahin über den Titel.
    textId?: string | null;
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
    /**
     * Bible passages kept with the songs. Optional: every playlist stored
     * before the Bibel tab existed simply has none.
     */
    passagen?: BibelPassage[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * A passage as a service plan or a playlist keeps it: where it starts, and
 * where a range ends. No text — the wording is read from the book when shown,
 * so a stored passage stays a few bytes and never goes out of date.
 */
export interface BibelPassage {
    slug: string;
    chapter: number;
    /** Absent for the whole chapter. */
    verse?: number;
    /** The last verse of a range within the chapter. */
    endVerse?: number;
}

// Preferences types

export interface XmlDisplaySettings {
    showMeasureNumbers: boolean;
    showLyrics: boolean;
    /** Colour the sounding note and its syllable while a song plays */
    highlightNotes: boolean;
    /** Show the band and the line that sweep the staff while a song plays */
    showPlayhead: boolean;
}

/** How the Bible's chapter page sets its text. */
export interface BibelDisplaySettings {
    /** Menge's section headings between the paragraphs */
    showHeadings: boolean;
    /** The verse numbers in the text */
    showVerseNumbers: boolean;
    /** Every footnote open in the line, instead of a marker to tap */
    notesInline: boolean;
    /** Each prose verse on a line of its own, instead of running paragraphs */
    versePerLine: boolean;
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
    /**
     * @deprecated Which of the two notations to show, and later what to do once
     * the page was outgrown. Neither is a choice any more: below the fit width
     * the engraving is simply better, and past it only the re-set notation can
     * show the song whole. Records written before that still carry these; they
     * are read by nothing and written by nothing.
     */
    melodyDisplayMode?: 'image' | 'xml';
    /** @deprecated See melodyDisplayMode. */
    notationBeyondFit?: 'engraving' | 'reflow';
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
    /**
     * Steer the playback tempo in beats per minute as well as in words.
     * Off by default: the transport asks in langsam / normal / schnell, which
     * is the question a hymnal reader has an answer to. See playbackTempo.
     */
    exactTempo?: boolean;
    /**
     * Show the Bible passages a song text draws on, below the song. Off by
     * default: the references were assigned by a language model and checked by
     * script, not by an editor, so whoever wants them switches them on.
     */
    showBibelstellen?: boolean;
    /** Offer the Bibel tab, to read through. Off by default. */
    showBibel?: boolean;
    /**
     * The Bible's own reading size (0.5–2.0). Left out until the reader sets
     * it, and until then the chapter page follows pageScale: whoever enlarged
     * the hymns wants the Bible larger too, until they say otherwise.
     */
    bibelScale?: number;
    /** How the chapter page sets the text. The store supplies the defaults. */
    bibelDisplay?: Partial<BibelDisplaySettings>;
    /**
     * Which translation the Bible is read in: one or the other, never both on
     * one page. Left out means Menge, the translation with section headings.
     */
    bibelTranslation?: BibelTranslationId;
    /**
     * The Bible's feature switches the reader set — only those. A switch never
     * touched is not stored and follows the store's defaults, so a default can
     * change for everyone who never chose.
     */
    bibelFeatures?: Partial<BibelFeatures>;
    /**
     * @deprecated A second translation set beside Menge, verse by verse. The
     * view was dropped for a choice of one translation; records written while
     * it existed still carry this, and nothing reads it.
     */
    bibelParallel?: 'luther1912' | null;
}

/** The translations the Bible can be read in (see BIBEL_TRANSLATIONS). */
export type BibelTranslationId = 'menge' | 'luther1912';

/**
 * The Bible's features a reader can do without. Each one switched off takes
 * its controls and sections away; what was stored for it stays, and comes
 * back when it is switched on again.
 */
export interface BibelFeatures {
    /** Chapters marked as read, progress per book, and the reading plans */
    fortschritt: boolean;
    /** Lesezeichen, set on a verse number */
    lesezeichen: boolean;
    /** Highlights and notes on verses */
    notizen: boolean;
    /** The Vers der Woche on the Bibel tab */
    versDerWoche: boolean;
    /** The songs that cite a chapter, below it */
    lieder: boolean;
    /** Reading a chapter aloud */
    vorlesen: boolean;
}

// Favorites: id == song id
export interface Favorite {
    id: string;
    createdAt: Date;
}

/**
 * A Lesezeichen in the Bible: one verse. The id is `slug/chapter/verse`, so a
 * verse can be marked only once.
 */
export interface Lesezeichen {
    id: string;
    slug: string;
    chapter: number;
    verse: number;
    /** The verse's opening words, so the list says what was marked. */
    snippet: string;
    createdAt: Date;
}

/** A chapter the reader has marked as read. The id is `slug/chapter`. */
export interface GelesenesKapitel {
    id: string;
    slug: string;
    chapter: number;
    readAt: Date;
}

export type MarkierungsFarbe = 'gelb' | 'gruen' | 'blau' | 'rosa';

/** A highlighted verse. The id is `slug/chapter/verse`. */
export interface Markierung {
    id: string;
    slug: string;
    chapter: number;
    verse: number;
    color: MarkierungsFarbe;
    createdAt: Date;
}

/** A personal note on a verse. The id is `slug/chapter/verse`. */
export interface Notiz {
    id: string;
    slug: string;
    chapter: number;
    verse: number;
    text: string;
    updatedAt: Date;
}

/** A reading plan the reader has started. The id is the plan's own id. */
export interface Leseplan {
    id: string;
    /** The day the plan began, as YYYY-MM-DD in local time. */
    startedOn: string;
    /** The plan days (1-based) the reader has ticked off. */
    doneDays: number[];
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
    /**
     * Which verses are sung, as the 1-based numbers the song page prints beside
     * them. Undefined or null means the whole hymn — which is what every entry
     * written before the Strophenwahl existed, and every plan adopted from a
     * provider, says.
     */
    verses?: number[] | null;
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
    /** The Lesungen, in the order they are read. Absent on older plans. */
    lesungen?: BibelPassage[];
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
    lesezeichen!: Table<Lesezeichen, string>;
    gelesen!: Table<GelesenesKapitel, string>;
    markierungen!: Table<Markierung, string>;
    notizen!: Table<Notiz, string>;
    leseplaene!: Table<Leseplan, string>;

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

        // Version 9: Lesezeichen in the Bible.
        this.version(9).stores({
            songs: 'id, titel',
            files: 'id, filename',
            auth: 'id',
            users: 'id, email, role',
            playlists: 'id, name, createdAt',
            preferences: 'id',
            favorites: 'id, createdAt',
            meta: 'key',
            services: 'id, date, expiresAt',
            lesezeichen: 'id, createdAt',
        });

        // Version 10: the reader's own marks in the Bible — chapters read,
        // highlights, notes — and the reading plans they follow.
        this.version(10).stores({
            songs: 'id, titel',
            files: 'id, filename',
            auth: 'id',
            users: 'id, email, role',
            playlists: 'id, name, createdAt',
            preferences: 'id',
            favorites: 'id, createdAt',
            meta: 'key',
            services: 'id, date, expiresAt',
            lesezeichen: 'id, createdAt',
            gelesen: 'id, slug, readAt',
            markierungen: 'id, slug, createdAt',
            notizen: 'id, slug, updatedAt',
            leseplaene: 'id',
        });
    }
}

// Export singleton instance
export const db = new GesangbuchDatabase();
