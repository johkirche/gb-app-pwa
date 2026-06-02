/**
 * Maps a song category to a representative emoji.
 *
 * Categories are matched by *name* (this app keys categories by name, not id),
 * normalised so the lookup is resilient to the small spelling variations that
 * appear in the data: en/em dashes vs. hyphens, spaces around slashes, and the
 * trailing date suffix on the Joseph-Weißenberg categories (e.g.
 * "Joseph Weißenberg – Geburtstag (24.08.)"). Unknown categories fall back to a
 * neutral musical note.
 *
 * Emoji set mirrors the sibling gb-pwa project so both apps feel consistent.
 */

const FALLBACK_EMOJI = '🎵';

// Human-readable category names → emoji. Keys are normalised at module load, so
// they can be written here exactly as they read in the data.
const CATEGORY_EMOJI: Record<string, string> = {
    Kinder: '👶',
    Jugend: '🧑‍🤝‍🧑',
    'Heiligabend / Weihnachten': '🎄',
    'Sakrament des Sterbens / Abschiedsfeier': '🕊️',
    Abendlied: '🌙',
    Advent: '🕯️',
    'Sakrament des Abendmahls': '🍞',
    'Joseph Weißenberg – Geburtstag': '🎂',
    Palmsonntag: '🌿',
    Karfreitag: '✝️',
    Ostersonntag: '🐣',
    Kirchentag: '⛪',
    Jahreswechsel: '🎊',
    'Sakrament der Taufe': '💧',
    Konfirmation: '🤝',
    Trauung: '💒',
    Verpflichtung: '📜',
    Freundschaft: '👫',
    Friedensstadt: '🏛️',
    'Joseph Weißenberg – Verurteilung': '⚖️',
    'Joseph Weißenberg – Heimgang': '🌅',
    Pfingsten: '🕊️',
    Erntedank: '🌾',
    'Ewigkeitssonntag (Totensonntag)': '🕯️',
    Passion: '💔',
    'Gemeinschaft / Miteinander': '👥',
    Loblied: '🙏',
    Stille: '🤫',
    'Christi Himmelfahrt': '☁️',
    Einigkeit: '🤝',
    Überbrückung: '🌉',
    Bekenntnistag: '📖',
    Geburtstag: '🎈',
    Frieden: '🕊️',
    Dennoch: '💪',
    Abschied: '👋',
    Trost: '🤗',
    Vertrauen: '🛡️',
    Kanon: '🎼',
    'Andere Sprache': '🌍',
    'Arbeit und Beruf': '⚒️',
    Rast: '🛋️',
    Danklied: '🙌',
    Nachfolge: '👣',
    'Reformation / Erneuerung': '🔄',
    'Gottes Wort': '📖',
    Segen: '✨',
    Morgenlied: '🌅',
    'Zuversicht / Hoffnung': '🌈',
    Glaubenstreue: '⚓',
    Gottesdienst: '⛪',
    'Schutz/Geleit/Kraft/Hilfe': '🛡️',
    'Lebensfreude / Lebensmut': '😊',
    'Schöpfung / Natur': '🌳',
    Sommer: '☀️',
    Frühling: '🌸',
    Ewigkeit: '♾️',
    Bauen: '🏗️',
    'Bekenntnis / Glaube': '✝️',
    'Zeit / Lebenszeit': '⏰',
    Demut: '🙇',
    'Gottes Liebe / Gott ist Liebe': '❤️',
    Gastfreundschaft: '🏠',
};

function normalize(name: string): string {
    return name
        .toLowerCase()
        .replace(/[–—]/g, '-') // en/em dash → hyphen
        .replace(/\s*\(\d{1,2}\.\d{1,2}\.?\)\s*$/, '') // strip trailing date "(24.08.)"
        .replace(/\s*\/\s*/g, '/') // tighten spaces around slashes
        .replace(/\s+/g, ' ')
        .trim();
}

const NORMALIZED_MAP = new Map(
    Object.entries(CATEGORY_EMOJI).map(([name, emoji]) => [normalize(name), emoji]),
);

export function categoryEmoji(name: string): string {
    return NORMALIZED_MAP.get(normalize(name)) ?? FALLBACK_EMOJI;
}
