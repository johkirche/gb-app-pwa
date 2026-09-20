import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import IndexScroll from './IndexScroll.vue';

/**
 * The rail was a stack of <div>s with a click handler: no role, no tab stop, no
 * name, and a 21px target. It is the fastest way into 500 hymns and it was the
 * one control in the app that only a sighted, pointing reader could use.
 *
 * jsdom lays nothing out, so the band never measures and every item is
 * rendered — which is what these tests want anyway: the semantics of a label,
 * not how many of them fit.
 */

const LETTERS = ['A', 'B', 'C', 'D'].map((letter) => ({
    key: letter,
    label: letter,
    ariaLabel: `Buchstabe ${letter}`,
}));

function mountRail(activeKey = 'B') {
    return mount(IndexScroll, {
        props: { items: LETTERS, activeKey },
        attachTo: document.body,
    });
}

const labels = (wrapper: ReturnType<typeof mountRail>) => wrapper.findAll('button.index-item');

describe('the rail announces itself', () => {
    it('is a vertical toolbar with a name', () => {
        const rail = mountRail();
        const root = rail.get('.index-scroll');

        expect(root.attributes('role')).toBe('toolbar');
        expect(root.attributes('aria-orientation')).toBe('vertical');
        expect(root.attributes('aria-label')).toBeTruthy();

        rail.unmount();
    });

    it('gives every label a button and a sentence to read', () => {
        const rail = mountRail();

        // A column of single glyphs reads as a column; one glyph read alone
        // does not, so each button says what its letter means.
        expect(labels(rail).map((b) => b.attributes('aria-label'))).toEqual([
            'Buchstabe A',
            'Buchstabe B',
            'Buchstabe C',
            'Buchstabe D',
        ]);
        expect(labels(rail).every((b) => b.attributes('type') === 'button')).toBe(true);

        rail.unmount();
    });

    it('falls back to the drawn label when no sentence is given', () => {
        const rail = mount(IndexScroll, { props: { items: [{ key: 'A', label: 'A' }] } });

        expect(rail.get('button.index-item').attributes('aria-label')).toBe('A');

        rail.unmount();
    });

    it('marks the section the list is sitting on', () => {
        const rail = mountRail('C');

        expect(labels(rail).map((b) => b.attributes('aria-current'))).toEqual([
            undefined,
            undefined,
            'location',
            undefined,
        ]);

        rail.unmount();
    });
});

describe('the rail takes one tab stop', () => {
    it('leaves exactly one label tabbable', () => {
        const rail = mountRail();

        expect(labels(rail).filter((b) => b.attributes('tabindex') === '0')).toHaveLength(1);

        rail.unmount();
    });

    it('parks that stop on the active section, not the top of the alphabet', async () => {
        const rail = mountRail('A');
        await rail.setProps({ activeKey: 'C' });

        expect(labels(rail)[2].attributes('tabindex')).toBe('0');

        rail.unmount();
    });

    it('walks the labels with the arrow keys', async () => {
        const rail = mountRail('A');
        const root = rail.get('.index-scroll');

        await root.trigger('keydown', { key: 'ArrowDown' });
        expect(document.activeElement).toBe(labels(rail)[1].element);

        await root.trigger('keydown', { key: 'ArrowDown' });
        expect(document.activeElement).toBe(labels(rail)[2].element);

        await root.trigger('keydown', { key: 'ArrowUp' });
        expect(document.activeElement).toBe(labels(rail)[1].element);

        rail.unmount();
    });

    it('reaches both ends and stops there', async () => {
        const rail = mountRail('A');
        const root = rail.get('.index-scroll');

        await root.trigger('keydown', { key: 'End' });
        expect(document.activeElement).toBe(labels(rail)[3].element);

        // Past the last label is still the last label, not a wrap into nothing.
        await root.trigger('keydown', { key: 'ArrowDown' });
        expect(document.activeElement).toBe(labels(rail)[3].element);

        await root.trigger('keydown', { key: 'Home' });
        expect(document.activeElement).toBe(labels(rail)[0].element);

        await root.trigger('keydown', { key: 'ArrowUp' });
        expect(document.activeElement).toBe(labels(rail)[0].element);

        rail.unmount();
    });

    it('steps from the focused label even after the list scrolled under it', async () => {
        const rail = mountRail('D');
        const root = rail.get('.index-scroll');

        await root.trigger('keydown', { key: 'End' });

        // The reader scrolls the list with a finger while the rail holds focus.
        // The tab stop follows the list — back to A — but the arrow keys must
        // still step from where the focus actually is, not from the tab stop.
        await rail.setProps({ activeKey: 'A' });
        await nextTick();
        expect(labels(rail)[0].attributes('tabindex')).toBe('0');
        expect(document.activeElement).toBe(labels(rail)[3].element);

        await root.trigger('keydown', { key: 'ArrowUp' });
        expect(document.activeElement).toBe(labels(rail)[2].element);

        rail.unmount();
    });

    it('jumps on activation', async () => {
        const rail = mountRail();
        await labels(rail)[2].trigger('click');

        expect(rail.emitted('select')).toEqual([['C']]);

        rail.unmount();
    });
});

describe('the rail is big enough to hit', () => {
    const source = readFileSync(resolve(__dirname, 'IndexScroll.vue'), 'utf8');

    it('keeps a 24px target floor', () => {
        // WCAG 2.5.8. Stacked 21px labels also fail the spacing exception, so
        // the height is the whole of it.
        const minHeight = source.match(/min-height:\s*(\d+)px/);
        expect(Number(minHeight?.[1])).toBeGreaterThanOrEqual(24);

        const minWidth = source.match(/min-width:\s*(\d+)px/);
        expect(Number(minWidth?.[1])).toBeGreaterThanOrEqual(24);
    });

    it('measures the band against that same floor', () => {
        // The fallback decides how many labels are drawn before the first
        // measurement. Guessing them shorter than they are overfills the rail.
        const fallback = source.match(/const FALLBACK_ITEM_HEIGHT = (\d+);/);
        const minHeight = source.match(/min-height:\s*(\d+)px/);
        expect(fallback?.[1]).toBe(minHeight?.[1]);
    });
});
