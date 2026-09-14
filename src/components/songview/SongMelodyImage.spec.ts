import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SongMelodyImage from '@/components/songview/SongMelodyImage.vue';

// The band is measured with getBoundingClientRect, which jsdom answers with
// zeroes. Nothing here is about the band — this is about which note and which
// line of text end up lit.
beforeEach(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// Lied 8 in miniature: three noteheads, the first two carrying a syllable in
// each of two verses, the third carrying none because the word before it is
// held across it.
const ENGRAVING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 249.44 130.24">
    <use data-note="0" data-system="0"/>
    <use data-note="1" data-system="0"/>
    <use data-note="2" data-system="0"/>
    <path id="v1a" d="M0 0" data-lyric="0" data-verse="1"/>
    <path id="v2a" d="M0 0" data-lyric="0" data-verse="2"/>
    <path id="v1b" d="M0 0" data-lyric="1" data-verse="1"/>
    <path id="v2b" d="M0 0" data-lyric="1" data-verse="2"/>
    <g class="gb-systeme" fill="none" stroke="none">
        <rect data-system="0" x="4.24" y="8.36" width="240.96" height="15.24"/>
    </g>
</svg>`;

// The same three notes as the engraver writes them now: each note drawn from
// several elements, all repeating its ordinal, the stem before the head.
const GROUPED_ENGRAVING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 249.44 130.24">
    <path id="s0" d="M0 0" fill="none" stroke="#000000" data-note="0" data-system="0" data-part="stem"/>
    <use id="h0" data-note="0" data-system="0" data-part="head"/>
    <use id="d0" data-note="0" data-system="0" data-part="dot"/>
    <path id="s1" d="M0 0" fill="none" stroke="#000000" data-note="1" data-system="0" data-part="stem"/>
    <use id="h1" data-note="1" data-system="0" data-part="head"/>
    <path id="v1a" d="M0 0" data-lyric="0" data-verse="1"/>
    <path id="v1b" d="M0 0" data-lyric="1" data-verse="1"/>
    <g class="gb-systeme" fill="none" stroke="none">
        <rect data-system="0" x="4.24" y="8.36" width="240.96" height="15.24"/>
    </g>
</svg>`;

function notenbild(svgMarkup: string | null = ENGRAVING) {
    return mount(SongMelodyImage, {
        props: {
            svgMarkup,
            imageUrl: null,
            isLoading: false,
            scrollBoxStyle: {},
            canvasStyle: {},
            highlightNotes: true,
            showPlayhead: true,
        },
    });
}

/** The ids of everything currently lit, in document order */
function lit(wrapper: ReturnType<typeof notenbild>): string[] {
    return wrapper
        .findAll('.gb-play-active')
        .map((element) => element.attributes('id') ?? element.attributes('data-note') ?? '');
}

describe('SongMelodyImage – following a song across the engraving', () => {
    it('lights the sounding note and the syllable sung on it', () => {
        const wrapper = notenbild();
        wrapper.vm.mark({ note: 0, pass: 0, follow: false });

        expect(lit(wrapper)).toEqual(['0', 'v1a']);
    });

    it('sings the line below on the repeat — the same noteheads, other words', () => {
        const wrapper = notenbild();

        wrapper.vm.mark({ note: 0, pass: 0, follow: false });
        expect(lit(wrapper)).toEqual(['0', 'v1a']);

        // The repeat brings the same note round a second time. Nothing about
        // the note changed; the pass is the whole of the difference.
        wrapper.vm.mark({ note: 0, pass: 1, follow: false });
        expect(lit(wrapper)).toEqual(['0', 'v2a']);
    });

    it('leaves the held syllable lit across a note that carries none', () => {
        const wrapper = notenbild();

        wrapper.vm.mark({ note: 1, pass: 0, follow: false });
        expect(lit(wrapper)).toEqual(['1', 'v1b']);

        // Note 2 is inside a melisma: clearing the word would blank the text
        // for as long as it is held.
        wrapper.vm.mark({ note: 2, pass: 0, follow: false });
        expect(lit(wrapper)).toEqual(['2', 'v1b']);
    });

    it('lets go of the mark when the song comes to rest', () => {
        const wrapper = notenbild();
        wrapper.vm.mark({ note: 0, pass: 0, follow: false });
        wrapper.vm.mark(null);

        expect(lit(wrapper)).toEqual([]);
    });

    it('colours nothing where the reader turned the colouring off', async () => {
        const wrapper = notenbild();
        wrapper.vm.mark({ note: 0, pass: 0, follow: false });

        await wrapper.setProps({ highlightNotes: false });

        expect(lit(wrapper)).toEqual([]);
    });

    // The batch that grouped a note's pieces is what the whole note is lit from:
    // stem, head and dot all answer to the ordinal, and lighting the head alone
    // left the rest of the note in the page's ink.
    it('lights every piece the note is drawn from, stem and all', () => {
        const wrapper = notenbild(GROUPED_ENGRAVING);
        wrapper.vm.mark({ note: 0, pass: 0, follow: false });

        expect(lit(wrapper)).toEqual(['s0', 'h0', 'd0', 'v1a']);
    });

    it('lets go of every piece again when the next note sounds', () => {
        const wrapper = notenbild(GROUPED_ENGRAVING);

        wrapper.vm.mark({ note: 0, pass: 0, follow: false });
        wrapper.vm.mark({ note: 1, pass: 0, follow: false });

        expect(lit(wrapper)).toEqual(['s1', 'h1', 'v1b']);
    });

    // Tapping the page to move the music there. jsdom answers every box with
    // zeroes, so the geometry is staged: three noteheads spaced along one
    // system, which is the shape the arithmetic in notationHit is written for.
    describe('tapping a note', () => {
        function stageGeometry() {
            vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
                this: Element,
            ) {
                const note = this.getAttribute('data-note');
                if (note !== null) {
                    const left = 100 * Number(note);
                    return { left, right: left + 20, top: 10, bottom: 20, height: 10 } as DOMRect;
                }
                if (this.getAttribute('data-system') !== null) {
                    return { left: 0, right: 400, top: 0, bottom: 30, height: 30 } as DOMRect;
                }
                return { left: 0, right: 0, top: 0, bottom: 0, height: 0 } as DOMRect;
            });
        }

        // Dispatched rather than triggered: clientX/clientY are read-only on a
        // constructed event, so the coordinates have to go in through the
        // constructor. jsdom has no PointerEvent, and a MouseEvent under the
        // pointer type is what the listener is bound to anyway.
        async function tap(
            wrapper: ReturnType<typeof notenbild>,
            down: [number, number],
            up: [number, number] = down,
        ) {
            const page = wrapper.find('.noten-svg').element;
            const at = (type: string, [clientX, clientY]: [number, number]) =>
                page.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
            at('pointerdown', down);
            at('pointerup', up);
            await nextTick();
        }

        it('asks the playback for the note under the finger', async () => {
            stageGeometry();
            const wrapper = notenbild();
            await nextTick();

            await tap(wrapper, [210, 15]);

            expect(wrapper.emitted('pickNote')).toEqual([[2]]);
        });

        it('answers a tap beside a note with the nearest one', async () => {
            stageGeometry();
            const wrapper = notenbild();
            await nextTick();

            // Below the staff, between notes 0 and 1, nearer 1.
            await tap(wrapper, [90, 28]);

            expect(wrapper.emitted('pickNote')).toEqual([[1]]);
        });

        // A wide engraving is scrolled sideways with the same finger, and that
        // drag ends in a pointerup like any other.
        it('says nothing when the finger was scrolling the page', async () => {
            stageGeometry();
            const wrapper = notenbild();
            await nextTick();

            await tap(wrapper, [10, 15], [210, 15]);

            expect(wrapper.emitted('pickNote')).toBeUndefined();
        });

        it('says nothing on an engraving it cannot read', async () => {
            stageGeometry();
            const wrapper = notenbild(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0"/></svg>',
            );
            await nextTick();

            await tap(wrapper, [210, 15]);

            expect(wrapper.emitted('pickNote')).toBeUndefined();
        });
    });

    it('shows an unmapped engraving plainly rather than reaching into it', () => {
        const wrapper = notenbild(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0"/></svg>',
        );
        wrapper.vm.mark({ note: 0, pass: 0, follow: false });

        expect(lit(wrapper)).toEqual([]);
    });
});
