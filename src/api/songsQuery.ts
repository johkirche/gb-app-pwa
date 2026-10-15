import type { Autor, Category, NotenFile, Song } from '../db';

/**
 * The song query and its mapping onto the app's Song, free of any app state —
 * the songs API and the demo endpoint in worker/ both read songs through it, so
 * a field added to one cannot go missing from the other.
 *
 * Relative imports only, and types only from the app: the worker bundles this
 * file without Vite's `@/` alias or anything that needs a browser.
 */

// GraphQL response types (nested structure from Directus)
interface DirectusAutorEntity {
    vorname: string;
    nachname: string;
    geburtsjahr?: number | null;
    sterbejahr?: number | null;
    geburtsjahrePrefix?: string | null;
    sterbejahrPrefix?: string | null;
}

interface DirectusAutor {
    autorPrefix?: string | null;
    autorSuffix?: string | null;
    // Junction field on text_autor/melodie_autor. NOT selected in SONGS_QUERY
    // yet: whether GraphQL can expand it as an m2o relation is unverified
    // against the live schema — see the comment at SONGS_QUERY.
    ursprungsAutor?: DirectusAutorEntity | null;
    autor_id: DirectusAutorEntity;
}

interface DirectusNotenFile {
    directus_files_id: {
        filename_download: string;
        id: string;
    };
}

interface DirectusKategorie {
    kategorie_id: {
        id: number;
        name: string;
    };
}

interface DirectusStrophe {
    strophe: string;
    anmerkung: string | null;
    aenderungsvorschlag: string | null;
}

export interface DirectusGesangbuchlied {
    id: string;
    titel: string;
    liednummer2026: number | null;
    copyright?: string | null;
    textAutorExtraSuffix?: string | null;
    melodieAutorExtraSuffix?: string | null;
    notentext_mxml: {
        id: string;
        filename_download: string;
    } | null;
    notentext_svg: {
        id: string;
        filename_download: string;
    } | null;
    textId: {
        id: string;
        copyright?: string | null;
        strophenEinzeln: DirectusStrophe[];
        autorId: DirectusAutor[];
    } | null;
    melodieId: {
        id: string;
        titel: string | null;
        choralbuchNummer: number | null;
        copyright?: string | null;
        autorId: DirectusAutor[];
        noten: DirectusNotenFile[];
    } | null;
    kategorieId: DirectusKategorie[];
}

export interface DirectusResponse {
    gesangbuchlied: DirectusGesangbuchlied[];
}

// GraphQL query
//
// NOTE on ursprungsAutor: the junction collections text_autor/melodie_autor
// carry an ursprungsAutor field, but whether the live schema models it as an
// expandable m2o relation (allowing `ursprungsAutor { vorname … }`) or as a
// plain integer is unverified. Until that is confirmed against the live
// Directus instance, the nested selection is deliberately omitted and
// ursprungsAutorObj stays null — the formatter (src/utils/authorFormat.ts)
// already handles it and needs no change once the selection is re-added.
export const SONGS_QUERY = `
    query Songs($filter: gesangbuchlied_filter) { gesangbuchlied( filter: $filter limit: 5000 ) { id titel liednummer2026 copyright textAutorExtraSuffix melodieAutorExtraSuffix notentext_mxml { id filename_download } notentext_svg { id filename_download } textId { id copyright strophenEinzeln autorId { autorPrefix autorSuffix autor_id { vorname nachname geburtsjahr sterbejahr geburtsjahrePrefix sterbejahrPrefix } } } melodieId { id titel choralbuchNummer copyright autorId { autorPrefix autorSuffix autor_id { vorname nachname geburtsjahr sterbejahr geburtsjahrePrefix sterbejahrPrefix } } noten { directus_files_id { filename_download id } } } kategorieId { kategorie_id { name id } } } }
`;

// Merge junction row (autorPrefix/autorSuffix/ursprungsAutor) over the autor
// entity — mirrors the dashboard's junction-over-entity merge (store/app.js).
function mapAutor(a: DirectusAutor): Autor {
    return {
        vorname: a.autor_id?.vorname ?? '',
        nachname: a.autor_id?.nachname ?? '',
        geburtsjahr: a.autor_id?.geburtsjahr ?? null,
        sterbejahr: a.autor_id?.sterbejahr ?? null,
        geburtsjahrePrefix: a.autor_id?.geburtsjahrePrefix ?? null,
        sterbejahrPrefix: a.autor_id?.sterbejahrPrefix ?? null,
        autorPrefix: a.autorPrefix ?? null,
        autorSuffix: a.autorSuffix ?? null,
        // Stays null until the ursprungsAutor selection is added to SONGS_QUERY
        // (see the note above the query).
        ursprungsAutorObj: a.ursprungsAutor
            ? {
                  vorname: a.ursprungsAutor.vorname ?? '',
                  nachname: a.ursprungsAutor.nachname ?? '',
                  geburtsjahr: a.ursprungsAutor.geburtsjahr ?? null,
                  sterbejahr: a.ursprungsAutor.sterbejahr ?? null,
                  geburtsjahrePrefix: a.ursprungsAutor.geburtsjahrePrefix ?? null,
                  sterbejahrPrefix: a.ursprungsAutor.sterbejahrPrefix ?? null,
              }
            : null,
    };
}

// Transform nested Directus response to flat Song structure
export function transformSong(directusSong: DirectusGesangbuchlied): Song {
    const textAutoren: Autor[] = directusSong.textId?.autorId?.map(mapAutor) || [];

    const melodieAutoren: Autor[] = directusSong.melodieId?.autorId?.map(mapAutor) || [];

    const noten: NotenFile[] =
        directusSong.melodieId?.noten?.map((n) => ({
            filename_download: n.directus_files_id.filename_download,
            id: n.directus_files_id.id,
        })) || [];

    const kategorien: Category[] =
        directusSong.kategorieId?.map((k) => ({
            name: k.kategorie_id.name,
            index: String(k.kategorie_id.id),
        })) || [];

    // Transform strophen - flatten the structure properly
    const strophen = (directusSong.textId?.strophenEinzeln || []).map((s, idx) => ({
        text: s.strophe, // The actual verse text from backend
        strophe: String(idx + 1), // Verse number
        anmerkung: s.anmerkung || null,
        aenderungsvorschlag: s.aenderungsvorschlag || null,
    }));

    const notentextMxml: NotenFile | null = directusSong.notentext_mxml
        ? {
              id: directusSong.notentext_mxml.id,
              filename_download: directusSong.notentext_mxml.filename_download,
          }
        : null;

    const notentextSvg: NotenFile | null = directusSong.notentext_svg
        ? {
              id: directusSong.notentext_svg.id,
              filename_download: directusSong.notentext_svg.filename_download,
          }
        : null;

    return {
        id: directusSong.id,
        index: directusSong.liednummer2026 ?? 0,
        titel: directusSong.titel,
        strophen,
        textAutoren,
        melodieAutoren,
        noten,
        notentextMxml,
        notentextSvg,
        kategorien,
        copyright: directusSong.copyright ?? null,
        textCopyright: directusSong.textId?.copyright ?? null,
        melodieCopyright: directusSong.melodieId?.copyright ?? null,
        textAutorExtraSuffix: directusSong.textAutorExtraSuffix ?? null,
        melodieAutorExtraSuffix: directusSong.melodieAutorExtraSuffix ?? null,
        // Die Weise. Die id wird als String festgehalten, weil sie in der App nur
        // noch verglichen wird — gegen die id am anderen Lied und gegen den
        // Deep-Link-Parameter, der immer ein String ist.
        melodieId: directusSong.melodieId ? String(directusSong.melodieId.id) : null,
        melodieTitel: directusSong.melodieId?.titel ?? null,
        choralbuchNummer: directusSong.melodieId?.choralbuchNummer ?? null,
        textId: directusSong.textId ? String(directusSong.textId.id) : null,
    };
}
