/**
 * The Directus folder holding the Gesangbuch's symbols: the stained-glass
 * roundels the printed book carries, offered here as a reader's avatar.
 *
 * The folder is the catalogue. A symbol added to it is on offer the next time
 * the picker opens, without a release; one taken out stops being offered, and
 * a reader who had chosen it keeps the copy on their device.
 */
export const SYMBOL_FOLDER_ID = 'e16a2921-5e5f-4a02-b24b-be938ab066ef';

/**
 * What each symbol is called, by the name part of its file — „…_v06_1_Drei_
 * Voegel.svg" is `drei-voegel` (see symbolSlug). Keyed by name rather than by
 * number, so a new version of the set (v07) or a new place in its order keeps
 * the names. A file this list does not know is named from the file itself.
 */
export const SYMBOL_NAMES: Readonly<Record<string, string>> = {
    'drei-voegel': 'Drei Vögel',
    'stadt-mit-kreuz': 'Stadt mit Kreuz',
    'stern-ueber-stadt': 'Stern über der Stadt',
    'arche-noah': 'Arche Noah',
    aehren: 'Ähren',
    kerze: 'Kerze',
    leuchtturm: 'Leuchtturm',
    lutherrose: 'Lutherrose',
    welle: 'Welle',
    'krippe-im-stall': 'Krippe im Stall',
    fische: 'Fische',
    'drei-kreuze': 'Drei Kreuze',
    menora: 'Menora',
    'altar-gott-ist-liebe': 'Altar „Gott ist Liebe"',
    'engel-mit-schwert': 'Engel mit Schwert',
    flamme: 'Flamme',
    'hirte-mit-schaf': 'Hirte mit Schaf',
    baum: 'Baum',
    'tannenbaum-mit-stern': 'Tannenbaum mit Stern',
    'kreuz-mit-strahlen': 'Kreuz mit Strahlen',
    'segnende-hand': 'Segnende Hand',
    'buch-alpha-omega': 'Buch mit Alpha und Omega',
    taube: 'Taube',
    anker: 'Anker',
    'heilige-drei-koenige': 'Heilige Drei Könige',
    'sonne-mond-sterne': 'Sonne, Mond und Sterne',
    'betende-haende': 'Betende Hände',
    'betender-engel': 'Betender Engel',
    schmetterling: 'Schmetterling',
    'kirche-im-wald': 'Kirche im Wald',
    sonnenblume: 'Sonnenblume',
    'maria-mit-kind': 'Maria mit Kind',
};
