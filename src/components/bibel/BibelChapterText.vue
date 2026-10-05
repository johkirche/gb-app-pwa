<template>
    <div class="bibel-chapter">
        <template v-for="(block, b) in laid" :key="`${slug}-${chapter}-${b}`">
            <!-- Menge's own headings, from the book's main divisions down to its
                 subsections. -->
            <component
                :is="`h${block.level}`"
                v-if="block.kind === 'heading'"
                class="bibel-heading font-display font-semibold leading-tight"
                :class="`bibel-h${block.level}`"
            >
                {{ block.text }}
            </component>

            <!-- Prose runs its verses together as the page does; poetry keeps
                 Menge's lines and indents. -->
            <div v-else class="bibel-para" :class="{ 'bibel-poetry': block.poetry }">
                <span
                    v-for="(line, l) in block.lines"
                    :key="l"
                    class="bibel-line"
                    :style="line.indent ? { '--indent': line.indent } : undefined"
                >
                    <template v-for="(seg, s) in line.segments" :key="s">
                        <!-- The verse number is where a Lesezeichen is set and
                             taken off. -->
                        <button
                            v-if="seg.kind === 'verse'"
                            :id="`vers-${seg.verse}`"
                            type="button"
                            class="bibel-verse number-display"
                            :class="{ 'bibel-verse-set': isMarked(seg.verse) }"
                            :aria-pressed="isMarked(seg.verse)"
                            :aria-label="`Lesezeichen bei Vers ${seg.verse}`"
                            @click="toggleLesezeichen(seg.verse)"
                            v-text="seg.verse"
                        />
                        <button
                            v-else-if="seg.kind === 'note'"
                            type="button"
                            class="bibel-note-mark"
                            :aria-expanded="allNotesOpen || openNotes.has(seg.key)"
                            aria-label="Anmerkung"
                            @click="toggleNote(seg.key)"
                            v-text="'*'"
                        />
                        <span
                            v-else
                            :class="{
                                italic: seg.kind === 'italic',
                                'bibel-marked': seg.verse !== null && seg.verse === markedVerse,
                            }"
                            v-text="seg.text"
                        />
                        <span
                            v-if="seg.kind === 'note' && (allNotesOpen || openNotes.has(seg.key))"
                            class="bibel-note"
                            v-text="` (${seg.text})`"
                        />
                    </template>
                </span>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { toast } from 'vue-sonner';

import { useLesezeichenStore } from '@/stores/lesezeichen';

import { type Block, verseRefLabel } from '@/utils/bibel';
import { layoutChapter, snippet, verseText } from '@/utils/bibelLayout';

/**
 * One chapter's text: headings, prose and poetry, footnotes, and the verse
 * numbers that set a Lesezeichen. The page around it owns loading, scrolling
 * and navigation; this owns what happens on the text itself.
 */
const props = defineProps<{
    slug: string;
    chapter: number;
    blocks: Block[];
    /** A verse to mark as pointed at (a link's ?vers=). */
    markedVerse?: number | null;
    /** Show every footnote open in the line (the reader's Anmerkungen setting). */
    allNotesOpen?: boolean;
}>();

const laid = computed(() => layoutChapter(props.blocks));

// --- Footnotes ----------------------------------------------------------------

const openNotes = ref(new Set<string>());

function toggleNote(key: string) {
    const next = new Set(openNotes.value);
    if (!next.delete(key)) next.add(key);
    openNotes.value = next;
}

watch(
    () => [props.slug, props.chapter],
    () => {
        openNotes.value = new Set();
    },
);

// --- Lesezeichen ------------------------------------------------------------

const lesezeichenStore = useLesezeichenStore();

function isMarked(verse: number): boolean {
    return lesezeichenStore.has(props.slug, props.chapter, verse);
}

async function toggleLesezeichen(verse: number) {
    const { slug, chapter } = props;
    const label = verseRefLabel({ slug, chapter }, verse);
    try {
        const set = await lesezeichenStore.toggle(
            slug,
            chapter,
            verse,
            snippet(verseText(laid.value, verse)),
        );
        toast.success(set ? `Lesezeichen gesetzt: ${label}` : `Lesezeichen entfernt: ${label}`, {
            duration: 2000,
        });
    } catch (err) {
        console.error('Error saving the Lesezeichen:', err);
        toast.error('Das Lesezeichen konnte nicht gespeichert werden.');
    }
}
</script>

<style scoped>
.bibel-heading {
    text-wrap: balance;
}
.bibel-h2 {
    margin: 2rem 0 0.75rem;
    font-size: 1.45em;
}
.bibel-h3 {
    margin: 1.75rem 0 0.5rem;
    font-size: 1.2em;
}
.bibel-h4 {
    margin: 1.25rem 0 0.375rem;
    font-size: 1.05em;
    font-style: italic;
}
.bibel-heading:first-child {
    margin-top: 0.5rem;
}

.bibel-para {
    margin-bottom: 0.9em;
}

/* Prose: the lines are verses, run together into one paragraph. */
.bibel-para:not(.bibel-poetry) .bibel-line::after {
    content: ' ';
}

/* Poetry: one line per line, as Menge sets it. The verse numbers stand in a
   margin column of their own, so every line's words start on the same edge
   whether or not a verse begins there; Menge's indents step in from that edge,
   and a line too long for the column wraps a little further in still. */
.bibel-poetry .bibel-line {
    position: relative;
    display: block;
    padding-left: calc(1.75em + 0.875em * var(--indent, 0) + 0.875em);
    text-indent: -0.875em;
}

.bibel-verse {
    padding: 0 0.2em;
    margin-right: 0.15em;
    font-size: 0.7em;
    font-style: normal;
    line-height: 1;
    vertical-align: super;
    border-radius: 0.3em;
}
.bibel-verse:hover {
    background: var(--muted);
}

/* In the poetry's margin column, its right edge just short of the words.
   2.5em of the number's own size is the column's 1.75em of the text's; the
   translate puts the number's end there, however many digits it has. */
.bibel-poetry .bibel-verse {
    position: absolute;
    top: 0.55em;
    left: 2.5em;
    margin: 0;
    padding: 0.1em 0.2em;
    text-indent: 0;
    vertical-align: baseline;
    transform: translateX(calc(-100% - 0.35em));
}

/* A marked verse: its number on a gold tab, the way a ribbon marks a page.
   Colour only — the mark must not move a word. */
.bibel-verse-set,
.bibel-verse-set:hover {
    background: var(--gold);
    color: var(--background);
    font-weight: 700;
}

.bibel-note-mark {
    padding: 0 0.1em 0 0.05em;
    color: var(--gold);
    font-size: 0.85em;
    vertical-align: super;
    line-height: 0;
}

.bibel-note {
    color: var(--muted-foreground);
    font-size: 0.85em;
    font-style: italic;
}

.bibel-marked {
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    border-radius: 0.15em;
    box-decoration-break: clone;
}
</style>
