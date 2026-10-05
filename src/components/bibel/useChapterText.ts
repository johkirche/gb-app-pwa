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

    function onTextClick(event: MouseEvent) {
        const words = (event.target as Element).closest<HTMLElement>('[data-verse]');
        if (!words) return;
        // A long press or a drag that took hold of words is the browser's own
        // text selection, for copying a phrase; leave it be.
        const native = window.getSelection();
        if (native && !native.isCollapsed && native.toString().trim()) return;
        selection.toggle(Number(words.dataset.verse));
    }

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
        colorOf,
        highlightStyle,
        hasNote,
    };
}
