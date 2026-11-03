import { SYMBOL_NAMES } from '@/config/symbols';

/** A symbol as the picker offers it. */
export interface SymbolOption {
    id: string;
    /** What a screen reader says for it, and what the picker names the chosen one. */
    label: string;
    /** Its place in the book's own numbering; unnumbered ones go last. */
    order: number;
    /** Bytes, as Directus reports them; 0 when it does not. */
    filesize: number;
}

/** A file in the symbols folder, in the fields the list asks Directus for. */
export interface SymbolFile {
    id: string;
    title?: string | null;
    filename_download?: string | null;
    filesize?: number | string | null;
}

const SEPARATORS = /[\s_-]+/;
const NUMBER = /^\d+$/;

function split(source: string | null | undefined): string[] {
    return (source ?? '')
        .replace(/\.[^.]+$/, '')
        .split(SEPARATORS)
        .filter(Boolean);
}

/** What comes after the last number: „Gesangbuch-Symbole_v06_23_Drei_Voegel" → Drei, Voegel. */
function nameTokens(parts: string[]): string[] {
    let lastNumber = -1;
    parts.forEach((part, i) => {
        if (NUMBER.test(part)) lastNumber = i;
    });
    return parts.slice(lastNumber + 1);
}

/**
 * The key SYMBOL_NAMES is looked up by: the name part of the file, lower case,
 * hyphenated — „drei-voegel". The download name first, which is what the print
 * run named it; Directus' title is the same words, capitalised („Drei
 * Voegel"), so it gives the same key when the download name is missing.
 */
export function symbolSlug(file: SymbolFile): string {
    const fromName = nameTokens(split(file.filename_download));
    const tokens = fromName.length ? fromName : nameTokens(split(file.title));
    return tokens.join('-').toLowerCase();
}

/**
 * The symbol's name. SYMBOL_NAMES has the book's own, with its umlauts and
 * articles; a symbol it does not know yet (one added to the folder since) is
 * named by its title when somebody wrote one by hand, and by its file name
 * otherwise — „Drei Voegel" rather than nothing.
 */
export function symbolLabel(file: SymbolFile): string {
    const known = SYMBOL_NAMES[symbolSlug(file)];
    if (known) return known;

    const title = file.title?.trim();
    if (title && !split(title).some((part) => NUMBER.test(part))) return title;

    const parts = split(file.filename_download || file.title);
    return nameTokens(parts).join(' ') || parts.join(' ') || 'Symbol';
}

/** The number in the book's series („…_v06_23_Taube" is 23), or Infinity. */
export function symbolOrder(file: SymbolFile): number {
    const numbers = split(file.filename_download ?? file.title)
        .filter((part) => NUMBER.test(part))
        .map(Number);
    return numbers.length ? numbers[numbers.length - 1] : Infinity;
}

/** The folder's files as the picker lists them: in the book's order, then by name. */
export function toSymbols(files: SymbolFile[]): SymbolOption[] {
    return files
        .map((file) => ({
            id: file.id,
            label: symbolLabel(file),
            order: symbolOrder(file),
            filesize: Number(file.filesize) || 0,
        }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'de'));
}
