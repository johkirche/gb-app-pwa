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

/** Directus' tokens for a name: the title, or the download name without its extension. */
function tokens(file: SymbolFile): string[] {
    const source = file.title?.trim() || file.filename_download?.replace(/\.[^.]+$/, '') || '';
    return source.split(SEPARATORS).filter(Boolean);
}

/**
 * The symbol's name, from whatever Directus holds for it.
 *
 * The files arrive named for the print run — „Gesangbuch-Symbole_v06_23_Taube"
 * — and Directus makes the same into a title, „Gesangbuch Symbole V06 23
 * Taube". Everything up to the last number is the series, not the symbol, so
 * it goes. A title somebody has written by hand („Drei Vögel") has no number
 * in it and is taken as it stands, which is how the umlauts the file names
 * spell out („Voegel") get put right: in Directus, not here.
 */
export function symbolLabel(file: SymbolFile): string {
    const parts = tokens(file);
    let lastNumber = -1;
    parts.forEach((part, i) => {
        if (/^\d+$/.test(part)) lastNumber = i;
    });
    const name = parts.slice(lastNumber + 1).join(' ');
    return name || parts.join(' ') || 'Symbol';
}

/** The number in the book's series („…_v06_23_Taube" is 23), or Infinity. */
export function symbolOrder(file: SymbolFile): number {
    const source = file.filename_download?.replace(/\.[^.]+$/, '') ?? file.title ?? '';
    const numbers = source
        .split(SEPARATORS)
        .filter((part) => /^\d+$/.test(part))
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
