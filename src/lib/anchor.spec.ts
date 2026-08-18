import { describe, expect, it } from 'vitest';

import { anchorFromEvent } from './anchor';

function contextMenuEvent(row: HTMLElement, coords: { clientX: number; clientY: number }) {
    const event = new MouseEvent('contextmenu', coords);
    Object.defineProperty(event, 'currentTarget', { value: row });
    return event;
}

describe('anchorFromEvent', () => {
    it('anchors to the click point, so a context menu opens at the cursor', () => {
        const row = document.createElement('button');
        const anchor = anchorFromEvent(contextMenuEvent(row, { clientX: 420, clientY: 96 }));

        const rect = (anchor as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect();
        expect([rect.x, rect.y, rect.width, rect.height]).toEqual([420, 96, 0, 0]);
    });

    it('falls back to the element when the event carries no coordinates', () => {
        const row = document.createElement('button');
        const anchor = anchorFromEvent(contextMenuEvent(row, { clientX: 0, clientY: 0 }));

        expect(anchor).toBe(row);
    });
});
