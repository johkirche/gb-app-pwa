import { beforeEach, describe, expect, it } from 'vitest';

import { useVerseSelection } from './useVerseSelection';

describe('useVerseSelection', () => {
    const selection = useVerseSelection();

    beforeEach(() => selection.attach({ slug: 'psalm', chapter: 23 }, []));

    it('picks verses out one tap at a time, and puts one back on a second tap', () => {
        selection.toggle(3);
        selection.toggle(1);
        expect(selection.verses.value).toEqual([1, 3]);
        expect(selection.isSelected(3)).toBe(true);

        selection.toggle(3);
        expect(selection.verses.value).toEqual([1]);
        expect(selection.isSelected(3)).toBe(false);
    });

    it('is shared: the action bar sees what the text picked', () => {
        selection.toggle(2);
        expect(useVerseSelection().verses.value).toEqual([2]);
    });

    it('starts empty on the next chapter', () => {
        selection.toggle(2);
        selection.openNote(2);

        selection.attach({ slug: 'psalm', chapter: 24 }, []);

        expect(selection.verses.value).toEqual([]);
        expect(selection.noteVerse.value).toBeNull();
        expect(selection.here.value).toEqual({ slug: 'psalm', chapter: 24 });
    });
});
