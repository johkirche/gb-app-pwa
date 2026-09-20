import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import SongSectionHeader from './SongSectionHeader.vue';

/**
 * The divider is the page's only complete list of its own sections — the A–Z
 * rail beside it draws as many labels as fit and no more. So it has to be a
 * heading, in every sort mode, whether or not it is inked.
 */

const PROPS = { sectionKey: 'A', label: 'A', spokenLabel: 'Buchstabe A' };

/** The component's root is a fragment (leading comment), so ask for the tag. */
function heading(props: Record<string, unknown>) {
    const wrapper = mount(SongSectionHeader, { props: { ...PROPS, ...props } });
    return { wrapper, h2: wrapper.get('h2') };
}

describe('the section divider', () => {
    it('is a heading a rotor can find', () => {
        const { wrapper, h2 } = heading({});

        // "A" alone is a letter, a grade or a musical key.
        expect(h2.attributes('aria-label')).toBe('Buchstabe A');

        wrapper.unmount();
    });

    it('still draws the editorial divider', () => {
        const { wrapper, h2 } = heading({});

        // SongsListPage measures `.section-header` to clear the sticky row.
        expect(h2.classes()).toContain('section-header');
        expect(h2.classes()).toContain('sticky');
        expect(h2.classes()).not.toContain('sr-only');
        expect(h2.text()).toBe('A');

        wrapper.unmount();
    });

    it('keeps the heading and drops the ink when asked', () => {
        const { wrapper, h2 } = heading({ visuallyHidden: true });

        expect(h2.attributes('aria-label')).toBe('Buchstabe A');
        expect(h2.classes()).toContain('sr-only');

        // Nothing that occupies the page, and nothing for getStickyOffset to
        // measure: in Nummer mode there is no divider to clear.
        expect(h2.classes()).not.toContain('section-header');
        expect(h2.classes()).not.toContain('sticky');

        wrapper.unmount();
    });
});
