<template>
    <!-- As BibelChapterText: one listener for every verse's words. Only
         Menge's words carry data-verse; the second text is there to be read
         beside them, not to be marked. -->
    <div class="bibel-chapter" @click="onTextClick">
        <!-- Which text is which: over the columns on a wide screen; on a phone,
             once, since Luther's verse always sits under Menge's. -->
        <div
            class="mb-3 grid gap-x-8 border-b border-border pb-2 md:grid-cols-2"
            aria-hidden="true"
        >
            <p class="label-micro hidden text-muted-foreground md:block">{{ primaryLabel }}</p>
            <p class="label-micro text-muted-foreground">
                <span class="md:hidden">Darunter:</span>
                {{ secondaryLabel }}
            </p>
        </div>

        <template v-for="(row, r) in rows" :key="`${slug}-${chapter}-${r}`">
            <!-- Menge's headings, across both columns: Luther 1912 has none. -->
            <component
                :is="`h${row.level}`"
                v-if="row.kind === 'heading'"
                class="bibel-heading font-display font-semibold leading-tight"
                :class="`bibel-h${row.level}`"
            >
                {{ row.text }}
            </component>

            <!-- A verse: Menge's and Luther's in one row on a wide screen, so
                 they line up; Luther's under Menge's, smaller, on a phone. -->
            <div v-else class="bibel-row grid gap-x-8 md:grid-cols-2">
                <div>
                    <template v-if="row.primary.length">
                        <span
                            v-for="piece in row.primary"
                            :key="piece.key"
                            class="bibel-piece"
                            :class="{ 'bibel-piece-poetry': piece.poetry }"
                            :style="piece.indent ? { '--indent': piece.indent } : undefined"
                        >
                            <template v-for="(seg, s) in piece.segments" :key="s">
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
                                    :data-verse="seg.verse ?? undefined"
                                    :class="{
                                        italic: seg.kind === 'italic',
                                        'bibel-hl': seg.verse !== null && !!colorOf(seg.verse),
                                        'bibel-selected':
                                            seg.verse !== null && selection.isSelected(seg.verse),
                                        'bibel-marked':
                                            seg.verse !== null && seg.verse === markedVerse,
                                    }"
                                    :style="highlightStyle(seg.verse)"
                                    v-text="seg.text"
                                />
                                <span
                                    v-if="
                                        seg.kind === 'note' &&
                                        (allNotesOpen || openNotes.has(seg.key))
                                    "
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
                            </template>
                        </span>
                        <!-- After the verse's words: its note, if it has one. -->
                        <template v-for="verse in row.verses" :key="`note-${verse}`">
                            <button
                                v-if="hasNote(verse)"
                                type="button"
                                class="bibel-note-icon"
                                :aria-label="`Notiz zu Vers ${verse}`"
                                @click="selection.openNote(verse)"
                            >
                                <NotebookPen aria-hidden="true" />
                            </button>
                        </template>
                    </template>
                    <!-- A verse only Luther has. -->
                    <span v-else class="text-muted-foreground">
                        <span aria-hidden="true">—</span>
                        <span class="sr-only">Bei Menge nicht vorhanden</span>
                    </span>
                </div>

                <div class="bibel-secondary mt-1 text-muted-foreground md:mt-0">
                    <template v-if="row.secondary.length">
                        <span v-for="entry in row.secondary" :key="entry.verse">
                            <!-- Luther's own count where it is not Menge's:
                                 "2,28" beside Menge's Joel 3,1. -->
                            <sup
                                class="bibel-secondary-verse number-display"
                                v-text="ownNumber(entry, chapter) ?? entry.verse"
                            />
                            {{ entry.text }}
                        </span>
                    </template>
                    <!-- A verse Luther lacks, or counts elsewhere. -->
                    <span v-else-if="row.verses.length">
                        <span aria-hidden="true">—</span>
                        <span class="sr-only">Bei Luther nicht vorhanden</span>
                    </span>
                </div>
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
import { type SecondaryVerse, ownNumber, parallelRows } from '@/utils/bibelParallel';
import { noteParts } from '@/utils/bibelVerses';

import './bibel-marks.css';
import './bibel-words.css';

/**
 * A chapter of Menge with a second translation beside it, verse by verse.
 * Menge's side is the text as BibelChapterText has it — Lesezeichen,
 * selection, highlights, notes, footnotes, all through useChapterText — set
 * in rows rather than paragraphs, so each verse can meet its counterpart.
 * The second text is only read: every mark a reader sets is Menge's.
 */
const props = defineProps<{
    slug: string;
    chapter: number;
    blocks: Block[];
    /** The second translation's verses, by Menge's number (see secondaryVerses). */
    secondary: ReadonlyMap<number, SecondaryVerse>;
    primaryLabel: string;
    secondaryLabel: string;
    /** A verse to mark as pointed at (a link's ?vers=). */
    markedVerse?: number | null;
    /** Show every footnote open in the line (the reader's Anmerkungen setting). */
    allNotesOpen?: boolean;
}>();

const laid = computed(() => layoutChapter(props.blocks));
const rows = computed(() => parallelRows(laid.value, props.secondary));

const {
    openNotes,
    toggleNote,
    isMarked,
    toggleLesezeichen,
    selection,
    onTextClick,
    colorOf,
    highlightStyle,
    hasNote,
} = useChapterText(
    () => props.slug,
    () => props.chapter,
    laid,
);
</script>

<style scoped>
.bibel-row {
    margin-bottom: 0.75em;
}

/* Prose pieces run on within the verse; poetry keeps Menge's lines and
   indents, a long line wrapping a little further in. */
.bibel-piece::after {
    content: ' ';
}
.bibel-piece-poetry {
    display: block;
    padding-left: calc(0.875em * var(--indent, 0) + 0.875em);
    text-indent: -0.875em;
}

/* On a phone Luther is the gloss under Menge's verse; beside it, on a wide
   screen, nearly its equal. */
.bibel-secondary {
    font-size: 0.85em;
}
@media (min-width: 768px) {
    .bibel-secondary {
        font-size: 0.95em;
    }
}

.bibel-secondary-verse {
    margin-right: 0.2em;
    font-size: 0.7em;
}
</style>
