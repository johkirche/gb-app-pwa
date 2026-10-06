import { type Ref, computed, onBeforeUnmount, ref, watch } from 'vue';

import { toast } from 'vue-sonner';

import { useLesezeichenStore } from '@/stores/lesezeichen';
import { useMarkierungenStore } from '@/stores/markierungen';
import { useNotizenStore } from '@/stores/notizen';
import { usePreferencesStore } from '@/stores/preferences';

import { useVerseSelection } from '@/composables/useVerseSelection';

import { verseRefLabel } from '@/utils/bibel';
import { type LaidBlock, snippet, verseText } from '@/utils/bibelLayout';

/**
 * What a chapter's text does when the reader touches it: footnotes that open,
 * verse numbers that set a Lesezeichen, words that pick a verse out for the
 * action bar, and the highlights and notes the verses wear. The component
 * (BibelChapterText) owns how the words are laid out; this owns what they mean.
 *
 * Lesezeichen and highlights/notes can be switched off under Einstellungen →
 * Bibel. Switched off, the numbers are only numbers and the verses wear
 * nothing — what was stored stays, and shows again once switched back on.
 */
/** How long a verse is held to pick it out. */
const HOLD_MS = 500;
/** How far a finger may drift before a hold counts as a scroll. */
const HOLD_SLOP = 10;

export function useChapterText(
    slug: () => string,
    chapter: () => number,
    laid: Readonly<Ref<LaidBlock[]>>,
) {
    const preferences = usePreferencesStore();
    const canBookmark = computed(() => preferences.bibelFeatures.lesezeichen);
    const showsMarks = computed(() => preferences.bibelFeatures.notizen);

    // --- Footnotes ------------------------------------------------------------

    const openNotes = ref(new Set<string>());

    function toggleNote(key: string) {
        const next = new Set(openNotes.value);
        if (!next.delete(key)) next.add(key);
        openNotes.value = next;
    }

    watch([slug, chapter], () => {
        openNotes.value = new Set();
    });

    // --- Lesezeichen ----------------------------------------------------------

    const lesezeichenStore = useLesezeichenStore();

    function isMarked(verse: number): boolean {
        return canBookmark.value && lesezeichenStore.has(slug(), chapter(), verse);
    }

    async function toggleLesezeichen(verse: number) {
        if (!canBookmark.value) return;
        const here = { slug: slug(), chapter: chapter() };
        const label = verseRefLabel(here, verse);
        try {
            const set = await lesezeichenStore.toggle(
                here.slug,
                here.chapter,
                verse,
                snippet(verseText(laid.value, verse)),
            );
            toast.success(
                set ? `Lesezeichen gesetzt: ${label}` : `Lesezeichen entfernt: ${label}`,
                { duration: 2000 },
            );
        } catch (err) {
            console.error('Error saving the Lesezeichen:', err);
            toast.error('Das Lesezeichen konnte nicht gespeichert werden.');
        }
    }

    // --- Picking verses out -----------------------------------------------------

    const selection = useVerseSelection();

    // Each chapter starts with nothing picked out; the action bar reads the
    // chapter and its layout from here.
    watch(
        [slug, chapter, laid],
        () => selection.attach({ slug: slug(), chapter: chapter() }, laid.value),
        { immediate: true },
    );
    // Only if the selection is still this chapter's: the next chapter's text may
    // already have attached its own.
    onBeforeUnmount(() => {
        if (selection.laid.value === laid.value) selection.detach();
    });

    // --- Holding a verse to pick it out ----------------------------------------
    //
    // On a touch screen a verse is picked out by holding it, not by a tap: a
    // hand that steadies the phone, or brushes the glass while scrolling, must
    // not throw the action sheet over the text. Once something is picked out,
    // taps add and remove verses — the way photos are picked in a gallery.
    // A mouse is never brushed by accident, so there a click does it (and a
    // held button stays what it is on a desktop: the start of a text selection).

    function wordsAt(target: EventTarget | null): HTMLElement | null {
        return (target as Element | null)?.closest<HTMLElement>('[data-verse]') ?? null;
    }

    /** A real mouse — not the dev phone preview, which rehearses touch with one. */
    function isMouse(pointerType: string): boolean {
        return (
            pointerType === 'mouse' &&
            !document.documentElement.classList.contains('viewport-preview')
        );
    }

    let hold: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
    let lastPointer = 'mouse';
    // The click a completed hold ends in must not take the verse straight back.
    let swallowClick = false;

    function cancelHold() {
        if (hold) clearTimeout(hold.timer);
        hold = null;
    }

    function onTextPointerDown(event: PointerEvent) {
        lastPointer = event.pointerType;
        cancelHold();
        if (isMouse(event.pointerType)) return;
        const words = wordsAt(event.target);
        if (!words) return;
        const verse = Number(words.dataset.verse);
        hold = {
            x: event.clientX,
            y: event.clientY,
            timer: setTimeout(() => {
                hold = null;
                swallowClick = true;
                if (!selection.isSelected(verse)) selection.toggle(verse);
                // A short buzz where the device has one: the hold took.
                navigator.vibrate?.(15);
            }, HOLD_MS),
        };
    }

    function onTextPointerMove(event: PointerEvent) {
        // A finger that moves is scrolling, not holding.
        if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > HOLD_SLOP) {
            cancelHold();
        }
    }

    function onTextClick(event: MouseEvent) {
        if (swallowClick) {
            swallowClick = false;
            return;
        }
        const words = wordsAt(event.target);
        if (!words) return;
        // A drag that took hold of words is the browser's own text selection,
        // for copying a phrase; leave it be.
        const native = window.getSelection();
        if (native && !native.isCollapsed && native.toString().trim()) return;
        // A tap only adds to a selection already begun by holding.
        if (!isMouse(lastPointer) && selection.verses.value.length === 0) return;
        selection.toggle(Number(words.dataset.verse));
    }

    /** The hold is ours on the verses: no copy/lookup menu from the system. */
    function onTextContextMenu(event: MouseEvent) {
        if (wordsAt(event.target) && !isMouse(lastPointer)) event.preventDefault();
    }

    onBeforeUnmount(cancelHold);

    // --- Highlights and notes -------------------------------------------------

    const markierungen = useMarkierungenStore();
    const notizen = useNotizenStore();

    function colorOf(verse: number) {
        if (!showsMarks.value) return undefined;
        return markierungen.colorOf(slug(), chapter(), verse);
    }

    function highlightStyle(verse: number | null) {
        const color = verse !== null ? colorOf(verse) : undefined;
        return color ? { '--hl': `var(--bibel-mark-${color})` } : undefined;
    }

    function hasNote(verse: number): boolean {
        return showsMarks.value && notizen.has(slug(), chapter(), verse);
    }

    return {
        openNotes,
        toggleNote,
        canBookmark,
        isMarked,
        toggleLesezeichen,
        selection,
        onTextClick,
        onTextPointerDown,
        onTextPointerMove,
        onTextPointerEnd: cancelHold,
        onTextContextMenu,
        colorOf,
        highlightStyle,
        hasNote,
    };
}
