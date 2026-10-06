/**
 * How many of the verse bar's actions stand in the bar, and which go under
 * "Mehr". The bar has room for five on the narrowest phone; a sixth would be
 * scrolled to or cut off, so past five the fifth place becomes "Mehr" and the
 * rest go into its menu — the first four, in the order given, stay at hand.
 */
export const VERSE_BAR_SLOTS = 5;

export function fitActions<T>(
    actions: readonly T[],
    slots = VERSE_BAR_SLOTS,
): { inBar: T[]; more: T[] } {
    if (actions.length <= slots) return { inBar: [...actions], more: [] };
    return { inBar: actions.slice(0, slots - 1), more: actions.slice(slots - 1) };
}
