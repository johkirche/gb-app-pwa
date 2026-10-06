<template>
    <!-- One listener for every verse's words: a chapter like Psalm 119 has
         thousands of runs, and each only needs to say which verse it is. -->
    <div
        class="bibel-chapter"
        @click="onTextClick"
        @pointerdown="onTextPointerDown"
        @pointermove="onTextPointerMove"
        @pointerup="onTextPointerEnd"
        @pointercancel="onTextPointerEnd"
        @contextmenu="onTextContextMenu"
    >
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
                             taken off — with Lesezeichen switched off it is
                             only a number, and nothing to tab to or press. -->
                        <button
                            v-if="seg.kind === 'verse' && canBookmark"
                            :id="`vers-${seg.verse}`"
                            type="button"
                            class="bibel-verse number-display"
                            :class="{ 'bibel-verse-set': isMarked(seg.verse) }"
                            :aria-pressed="isMarked(seg.verse)"
                            :aria-label="`Lesezeichen bei Vers ${seg.verse}`"
                            @click="toggleLesezeichen(seg.verse)"
                            v-text="seg.verse"
                        />
                        <span
                            v-else-if="seg.kind === 'verse'"
                            :id="`vers-${seg.verse}`"
                            class="bibel-verse number-display"
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
                        <!-- A verse's words: tapped, they pick the verse out
                             for the action bar. -->
                        <span
                            v-else
                            :data-verse="seg.verse ?? undefined"
                            :class="{
                                italic: seg.kind === 'italic',
                                'bibel-hl': seg.verse !== null && !!colorOf(seg.verse),
                                'bibel-selected':
                                    seg.verse !== null && selection.isSelected(seg.verse),
                                'bibel-marked': seg.verse !== null && seg.verse === markedVerse,
                            }"
                            :style="highlightStyle(seg.verse)"
                            v-text="seg.text"
                        />
                        <!-- An open footnote, its references made links. -->
                        <span
                            v-if="seg.kind === 'note' && (allNotesOpen || openNotes.has(seg.key))"
                            class="bibel-note"
                        >
                            <template v-for="(part, p) in noteParts(seg.text)" :key="p">
                                <RouterLink
                                    v-if="part.ref"
                                    :to="chapterPath(part.ref, part.ref.verse)"
                                    class="bibel-note-link"
                                >
                                    <span v-text="part.text" />
                                </RouterLink>
                                <span v-else v-text="part.text" />
                            </template>
                        </span>
                        <!-- After a verse's last word: its note, if it has one. -->
                        <button
                            v-if="noteAt(b, l, s) !== null"
                            type="button"
                            class="bibel-note-icon"
                            :aria-label="`Notiz zu Vers ${noteAt(b, l, s)}`"
                            @click="selection.openNote(noteAt(b, l, s)!)"
                        >
                            <NotebookPen aria-hidden="true" />
                        </button>
                    </template>
                </span>
            </div>
        </template>

        <BibelNoteEditor />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { NotebookPen } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import BibelNoteEditor from '@/components/bibel/BibelNoteEditor.vue';
import { useChapterText } from '@/components/bibel/useChapterText';

import { type Block, chapterPath } from '@/utils/bibel';
import { layoutChapter } from '@/utils/bibelLayout';
import { noteParts, verseEnds } from '@/utils/bibelVerses';

import './bibel-marks.css';
import './bibel-words.css';

/**
 * One chapter's text: headings, prose and poetry, footnotes, the verse
 * numbers that set a Lesezeichen, and the words that pick a verse out for
 * the action bar and wear its highlight and note. The page around it owns
 * loading, scrolling and navigation; this owns how the text is set, and
 * useChapterText what happens on it.
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

const {
    openNotes,
    toggleNote,
    canBookmark,
    isMarked,
    toggleLesezeichen,
    selection,
    onTextClick,
    onTextPointerDown,
    onTextPointerMove,
    onTextPointerEnd,
    onTextContextMenu,
    colorOf,
    highlightStyle,
    hasNote,
} = useChapterText(
    () => props.slug,
    () => props.chapter,
    laid,
);

const ends = computed(() => verseEnds(laid.value));

/** The verse whose note icon follows this run, if it ends a verse with a note. */
function noteAt(b: number, l: number, s: number): number | null {
    const verse = ends.value.get(`${b}.${l}.${s}`);
    return verse !== undefined && hasNote(verse) ? verse : null;
}
</script>

<!-- Headings, numbers, notes and marks: bibel-words.css, shared with the text
     set beside a second translation. -->
<style scoped>
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
</style>
