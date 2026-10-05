<template>
    <!-- Docked under the text while verses are picked out, the way the song
         page docks its transport: opaque, above the safe area, and taking its
         room from the scroller rather than covering the last lines. -->
    <footer
        v-if="here && verses.length"
        class="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
        aria-label="Verse"
    >
        <div class="mx-auto max-w-[36rem] px-3 pb-1.5 pt-2">
            <div class="flex items-center gap-2 pl-1">
                <p class="min-w-0 flex-1 truncate text-sm font-medium" aria-live="polite">
                    {{ label }}
                </p>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Auswahl aufheben"
                    @click="selection.clear()"
                >
                    <X aria-hidden="true" />
                </Button>
            </div>

            <!-- The four colours and a way back to none. The ring is on the
                 colour the whole selection already wears, if it wears one. -->
            <div
                v-if="colorsOpen && features.notizen"
                class="flex items-center justify-center gap-3 pb-1 pt-2"
                role="group"
                aria-label="Farbe"
            >
                <button
                    v-for="color in COLORS"
                    :key="color.key"
                    type="button"
                    class="size-9 rounded-full border border-border transition-transform active:scale-95"
                    :class="{
                        'ring-2 ring-primary ring-offset-2 ring-offset-background':
                            current === color.key,
                    }"
                    :style="{ background: `var(--bibel-mark-${color.key})` }"
                    :aria-label="color.label"
                    :aria-pressed="current === color.key"
                    @click="mark(color.key)"
                />
                <button
                    type="button"
                    class="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted active:scale-95"
                    aria-label="Markierung entfernen"
                    @click="mark(null)"
                >
                    <Eraser class="size-4" aria-hidden="true" />
                </button>
            </div>

            <div class="flex items-stretch gap-1 overflow-x-auto pt-1">
                <BibelVerseAction :icon="Copy" label="Kopieren" @click="copy" />
                <BibelVerseAction :icon="Share2" label="Teilen" @click="share" />
                <!-- Marking, notes and Lesezeichen only where they are
                     switched on (Einstellungen → Bibel). -->
                <BibelVerseAction
                    v-if="features.notizen"
                    :icon="Highlighter"
                    label="Markieren"
                    :aria-expanded="colorsOpen"
                    @click="colorsOpen = !colorsOpen"
                />
                <BibelVerseAction
                    v-if="features.notizen"
                    :icon="NotebookPen"
                    label="Notiz"
                    @click="note"
                />
                <BibelVerseAction
                    v-if="features.lesezeichen"
                    :icon="Bookmark"
                    label="Lesezeichen"
                    @click="bookmark"
                />
                <!-- More actions from the page that mounts the bar ("Zum
                     Gottesdienst hinzufügen" …). Render a BibelVerseAction per
                     action; the slot hands over what they act on, and `done`
                     to clear the selection once an action has run. -->
                <slot
                    :here="here"
                    :verses="verses"
                    :text="quote"
                    :label="label"
                    :done="selection.clear"
                />
            </div>
        </div>
    </footer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Bookmark, Copy, Eraser, Highlighter, NotebookPen, Share2, X } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-sonner';

import { useLesezeichenStore } from '@/stores/lesezeichen';
import { useMarkierungenStore } from '@/stores/markierungen';
import { usePreferencesStore } from '@/stores/preferences';

import { useVerseSelection } from '@/composables/useVerseSelection';

import BibelVerseAction from '@/components/bibel/BibelVerseAction.vue';
import { Button } from '@/components/ui/button';

import type { MarkierungsFarbe } from '@/db';
import { verseRefLabel } from '@/utils/bibel';
import { snippet, verseText } from '@/utils/bibelLayout';
import { copyText, versesRefLabel } from '@/utils/bibelVerses';

import './bibel-marks.css';

/**
 * What the reader can do with the verses picked out in the text: copy and
 * share them as a quotation, highlight them, write a note, set a Lesezeichen.
 * Reads the chapter and the selection from useVerseSelection, so the page
 * mounts it with no props, after its scroller.
 */

const COLORS: { key: MarkierungsFarbe; label: string }[] = [
    { key: 'gelb', label: 'Gelb' },
    { key: 'gruen', label: 'Grün' },
    { key: 'blau', label: 'Blau' },
    { key: 'rosa', label: 'Rosa' },
];

const selection = useVerseSelection();
const { here, verses } = selection;
const markierungen = useMarkierungenStore();
const lesezeichen = useLesezeichenStore();
const { bibelFeatures: features } = storeToRefs(usePreferencesStore());

const label = computed(() => (here.value ? versesRefLabel(here.value, verses.value) : ''));
const quote = computed(() =>
    here.value ? copyText(selection.laid.value, here.value, verses.value) : '',
);

const colorsOpen = ref(false);
// The colour row folds away with the selection it was for.
watch(
    () => verses.value.length,
    (count) => {
        if (count === 0) colorsOpen.value = false;
    },
);

/** The colour every selected verse wears, or null when they differ or wear none. */
const current = computed(() => {
    if (!here.value) return null;
    const { slug, chapter } = here.value;
    const colors = new Set(verses.value.map((v) => markierungen.colorOf(slug, chapter, v)));
    const [only] = colors;
    return colors.size === 1 && only ? only : null;
});

async function copy() {
    try {
        await navigator.clipboard.writeText(quote.value);
        toast.success(`Kopiert: ${label.value}`, { duration: 2000 });
        selection.clear();
    } catch (err) {
        console.error('Error copying the verses:', err);
        toast.error('Der Text konnte nicht kopiert werden.');
    }
}

async function share() {
    // Not every browser can share (desktop Firefox, for one): copying is the
    // nearest thing it can do.
    if (!navigator.share) {
        await copy();
        return;
    }
    try {
        await navigator.share({ text: quote.value });
        selection.clear();
    } catch (err) {
        // The reader closing the share sheet is no failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error sharing the verses:', err);
        await copy();
    }
}

async function mark(color: MarkierungsFarbe | null) {
    if (!here.value) return;
    const { slug, chapter } = here.value;
    try {
        await markierungen.setColor(slug, chapter, verses.value, color);
        selection.clear();
    } catch (err) {
        console.error('Error saving the Markierung:', err);
        toast.error('Die Markierung konnte nicht gespeichert werden.');
    }
}

function note() {
    const [first] = verses.value;
    selection.clear();
    selection.openNote(first);
}

async function bookmark() {
    if (!here.value) return;
    const { slug, chapter } = here.value;
    const [first] = verses.value;
    try {
        await lesezeichen.add(
            slug,
            chapter,
            first,
            snippet(verseText(selection.laid.value, first)),
        );
        toast.success(`Lesezeichen gesetzt: ${verseRefLabel(here.value, first)}`, {
            duration: 2000,
        });
        selection.clear();
    } catch (err) {
        console.error('Error saving the Lesezeichen:', err);
        toast.error('Das Lesezeichen konnte nicht gespeichert werden.');
    }
}
</script>
