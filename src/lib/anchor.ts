import type { ReferenceElement } from 'reka-ui';

/**
 * What a {@link ResponsivePanel} positions itself against in its desktop
 * (popover) form: the element that opened it, or a point the user clicked.
 */
export type PanelAnchor = ReferenceElement | null;

/**
 * The spot a pointer event happened at, as a zero-size virtual anchor — a
 * context menu should open at the cursor, not at the far corner of a
 * full-width list row.
 *
 * Falls back to the event's element when there are no usable coordinates
 * (keyboard-invoked context menus report 0/0).
 */
export function anchorFromEvent(event: MouseEvent): PanelAnchor {
    const element = (event.currentTarget ?? event.target) as HTMLElement | null;

    if (!event.clientX && !event.clientY) return element;

    const { clientX: x, clientY: y } = event;

    return {
        contextElement: element ?? undefined,
        getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
    };
}
