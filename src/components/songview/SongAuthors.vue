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

                <!-- Die Choralbuchnummer hängt an der Melodie-Zeile, nicht in
                     ihr: buildFooterLines ist die kanonische Fußzeilen-Grammatik,
                     gegen die der Druck geprüft wird (gb-dashboard, buildFooter)
                     — was hier zusätzlich steht, darf dort nicht mitzählen.
                     Antippbar wie ein Autor, weil sich gut die Hälfte der Lieder
                     ihre Weise mit einem anderen Lied teilt. -->
                <template v-if="line.weise">
                    <!-- Trenner und Buchzeichen als Interpolation bzw. eigenes
                         Element vor dem Link — nichts davon gehört unter den
                         gepunkteten Strich. -->
                    <span v-if="line.segments.length" class="text-muted-foreground">
                        {{ ' · ' }}
                    </span>
                    <BookOpen
                        class="mr-1 inline size-[1em] shrink-0 align-[-0.15em] text-muted-foreground"
                        aria-hidden="true"
                    />
                    <!-- Die Beschriftung kommt fertig aus dem Script und steht
                         als einzige Interpolation im Link: statischer Text neben
                         einer Interpolation zieht sonst das Zeilenumbruch-
                         Leerzeichen der Vorlage mit in den Anker (Vue kürzt nur
                         reine Whitespace-Knoten weg). Dieses Leerzeichen lag
                         unter dem Unterstrich und riss den Link in eine zweite
                         Zeile, sobald die Zeile die Spalte ausfüllte. -->
                    <RouterLink
                        :to="{ path: '/tabs/lieder', query: { weise: line.weise.id } }"
                        class="whitespace-nowrap underline decoration-dotted underline-offset-[3px] transition-colors hover:text-primary active:text-primary"
                        :aria-label="`Lieder auf derselben Weise anzeigen (${line.weise.label})`"
                    >
                        {{ line.weise.label }}
                    </RouterLink>
                </template>
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';

import { BookOpen, FileText, Music2 } from 'lucide-vue-next';
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
const footerLines = computed(() => {
    const lines = buildFooterLines({
        copyright: props.song.copyright,
        textAutorExtraSuffix: props.song.textAutorExtraSuffix,
        melodieAutorExtraSuffix: props.song.melodieAutorExtraSuffix,
        text: { authors: props.song.textAutoren, copyright: props.song.textCopyright },
        melodie: { authors: props.song.melodieAutoren, copyright: props.song.melodieCopyright },
    }).map((line) => ({
        kind: line.kind,
        icon: lineIcons[line.kind] ?? null,
        isCopyright: line.kind === 'copyright',
        segments: line.segments.map((segment) => ({
            text: segment.text,
            // Authors without a name (a bare "unbekannt" suffix, say) have
            // nothing to filter by and stay plain text.
            filterName: authorFilterName(segment.author),
        })),
        weise: null as { id: string; label: string } | null,
    }));

    // Die Weise gehört an die Melodie-Zeile — dort steht ohnehin schon alles
    // über sie. Nur wenn es keine gibt (weder Melodie-Autor noch
    // Melodie-Copyright, dann lässt buildFooterLines die Zeile weg), bekommt die
    // Nummer eine eigene Zeile, statt stillschweigend zu fehlen.
    const { melodieId, choralbuchNummer } = props.song;
    if (melodieId && choralbuchNummer != null) {
        const weise = { id: melodieId, label: `Choralbuch ${choralbuchNummer}` };
        const melodyLine = lines.find(
            (line) => line.kind === 'melodie' || line.kind === 'textUndMelodie',
        );
        if (melodyLine) {
            melodyLine.weise = weise;
        } else {
            lines.push({
                kind: 'melodie',
                icon: lineIcons.melodie ?? null,
                isCopyright: false,
                segments: [],
                weise,
            });
        }
    }

    return lines;
});
</script>
