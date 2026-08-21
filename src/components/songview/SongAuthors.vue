<template>
    <!-- Same measure as the verses above: the rule that separates them would
         otherwise run out past the text it belongs to. -->
    <div v-if="footerLines.length > 0" class="verse-col mt-auto border-t border-border pt-6">
        <div v-for="(line, idx) in footerLines" :key="idx" class="mb-2 flex items-start gap-2">
            <component
                :is="line.icon"
                v-if="line.icon"
                class="mt-0.5 size-[18px] shrink-0 text-muted-foreground"
                aria-hidden="true"
            />
            <span :class="line.isCopyright ? 'text-sm text-muted-foreground' : 'text-foreground'">
                <!-- Named authors are the way into the list: tapping one shows
                     every song of theirs. Everything else on the line (label,
                     copyright, Ursprungsautor) stays plain text.

                     A link, not a button, because a button element is an atomic
                     box in every engine — it cannot be split across lines, not
                     even with `display: inline`. A long name therefore wrapped as
                     one piece and left its "Text:" label stranded alone on the
                     line above. An anchor is a real inline box: the name starts
                     right after the label and breaks where it runs out of room.
                     Filtering the list by author is a navigation anyway, so the
                     link also gets us keyboard activation for free. -->
                <template v-for="(segment, segIdx) in line.segments" :key="segIdx">
                    <RouterLink
                        v-if="segment.filterName"
                        :to="{ path: '/tabs/lieder', query: { autor: segment.filterName } }"
                        class="break-words underline decoration-dotted underline-offset-[3px] transition-colors hover:text-primary active:text-primary"
                        :aria-label="`Lieder von ${segment.filterName} anzeigen`"
                    >
                        {{ segment.text }}
                    </RouterLink>
                    <template v-else>{{ segment.text }}</template>
                </template>
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';

import { FileText, Music2 } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import type { Song } from '@/db';
import { type FooterLineKind, authorFilterName, buildFooterLines } from '@/utils/authorFormat';

const props = defineProps<{
    song: Song;
}>();

const lineIcons: Partial<Record<FooterLineKind, Component>> = {
    text: FileText,
    melodie: Music2,
    textUndMelodie: Music2,
};

// Canonical footer grammar shared with the dashboard (utils/authorFormat):
//   Text: … / Melodie: … / "Text und Melodie: …" when identical, then "© …".
// Taken as segments rather than as text so each author keeps its own piece of
// the line — that piece is what becomes tappable.
const footerLines = computed(() =>
    buildFooterLines({
        copyright: props.song.copyright,
        textAutorExtraSuffix: props.song.textAutorExtraSuffix,
        melodieAutorExtraSuffix: props.song.melodieAutorExtraSuffix,
        text: { authors: props.song.textAutoren, copyright: props.song.textCopyright },
        melodie: { authors: props.song.melodieAutoren, copyright: props.song.melodieCopyright },
    }).map((line) => ({
        icon: lineIcons[line.kind] ?? null,
        isCopyright: line.kind === 'copyright',
        segments: line.segments.map((segment) => ({
            text: segment.text,
            // Authors without a name (a bare "unbekannt" suffix, say) have
            // nothing to filter by and stay plain text.
            filterName: authorFilterName(segment.author),
        })),
    })),
);
</script>
