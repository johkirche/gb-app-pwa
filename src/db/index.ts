import Dexie, { Table } from 'dexie';

// Type definitions based on GraphQL schema
export interface Autor {
    vorname: string;
    nachname: string;
    sterbejahr?: number;
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
    kategorien: Category[];
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
    skipAuth: boolean; // Dev flag to skip auth checks
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
export type MelodyDisplayMode = 'image' | 'xml';

export interface XmlDisplaySettings {
    showMeasureNumbers: boolean;
    showLyrics: boolean;
}

export interface PreferencesData {
    id: string;
    notationScale: number;
    textSize: 'small' | 'medium' | 'large' | 'xlarge';
    melodyDisplayMode: MelodyDisplayMode;
    xmlSettings?: XmlDisplaySettings;
}

// Favorites: id == song id
export interface Favorite {
    id: string;
    createdAt: Date;
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
    }
}

// Export singleton instance
export const db = new GesangbuchDatabase();
