<template>
    <!-- A small, true-to-life sample of what a feature does in the reader, and
         the one gesture that reaches it. Drawn with the reader's own classes
         (bibel-words.css, bibel-marks.css), so the gold tab, the wash and the
         note mark here are the ones on the page — the way the sample under
         Größe (Lieder) is the song page in miniature. Faded and without its
         colours while the feature is off — still readable, so the reader can
         see what switching it on would bring. -->
    <div
        class="mt-3 rounded-md border border-border bg-muted/40 px-3 py-3 transition-[opacity,filter] duration-200"
        :class="{ 'opacity-50 grayscale': off }"
        aria-hidden="true"
    >
        <!-- Reading: picking verses out, and the bar that acts on them. -->
        <template v-if="feature === 'lesen'">
            <p class="bibel-chapter font-hymnal text-[15px] leading-relaxed">
                <span class="bibel-verse number-display">1</span>
                Der HERR ist mein Hirt: mir mangelt nichts.
                <span class="bibel-verse number-display">2</span>
                <span class="bibel-selected">
                    Auf grünen Auen läßt er mich lagern, zum Lagerplatz am Bache führt er mich.
                </span>
            </p>
            <div
                class="mt-2 flex items-center gap-3 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground"
            >
                <span class="mr-auto whitespace-nowrap text-xs font-medium text-foreground">
                    Psalm 23,2
                </span>
                <span
                    v-for="action in ACTIONS"
                    :key="action.label"
                    class="flex flex-col items-center gap-0.5"
                >
                    <component :is="action.icon" class="size-4 text-foreground" />
                    {{ action.label }}
                </span>
            </div>
        </template>

        <!-- Lesefortschritt: the end-of-chapter mark, and the plan's day. -->
        <template v-else-if="feature === 'fortschritt'">
            <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="label-micro text-gold">Heute lesen · Tag 12 von 30</p>
                    <p class="mt-1 text-sm">
                        <span class="text-muted-foreground line-through">Psalm 56</span>
                        · Psalm 57 · Psalm 58
                    </p>
                </div>
                <svg viewBox="0 0 36 36" class="size-9 shrink-0 -rotate-90">
                    <circle
                        cx="18"
                        cy="18"
                        r="15"
                        class="fill-none stroke-border"
                        stroke-width="4"
                    />
                    <circle
                        cx="18"
                        cy="18"
                        r="15"
                        class="fill-none stroke-gold"
                        stroke-width="4"
                        stroke-dasharray="94.2"
                        stroke-dashoffset="58"
                        stroke-linecap="round"
                    />
                </svg>
            </div>
            <span
                class="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
                <CircleCheck class="size-3.5 text-gold" />
                Gelesen
            </span>
        </template>

        <!-- Lesezeichen: the gold tab on a verse number. -->
        <template v-else-if="feature === 'lesezeichen'">
            <p class="bibel-chapter font-hymnal text-[15px] leading-relaxed">
                <span class="bibel-verse bibel-verse-set number-display">4</span>
                Müßt’ ich auch wandern in finsterm Tal: ich fürchte kein Unglück, denn du bist bei
                mir …
            </p>
            <p class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Bookmark class="size-3.5 fill-current text-gold" />
                Psalm 23,4 — oben im Bibel-Reiter wiederzufinden
            </p>
        </template>

        <!-- Markierungen & Notizen: a washed verse, and a verse with a note. -->
        <template v-else-if="feature === 'notizen'">
            <p class="bibel-chapter font-hymnal text-[15px] leading-relaxed">
                <span class="bibel-verse number-display">3</span>
                <span class="bibel-hl" style="--hl: var(--bibel-mark-gelb)">
                    Er erquickt meine Seele; er leitet mich auf rechten Pfaden
                </span>
                um seines Namens willen.
                <span class="bibel-verse number-display">5</span>
                Du deckst mir reichlich den Tisch
                <span class="bibel-note-icon"><NotebookPen /></span>
            </p>
            <div class="mt-2 flex gap-1.5">
                <span
                    v-for="color in COLORS"
                    :key="color"
                    class="size-4 rounded-full border border-border"
                    :style="{ background: `var(--bibel-mark-${color})` }"
                />
            </div>
        </template>

        <!-- Vers der Woche: the card at the top of the tab. -->
        <template v-else-if="feature === 'versDerWoche'">
            <p class="label-micro text-gold">Vers der Woche</p>
            <p class="mt-1 font-hymnal text-[15px] leading-snug">
                Der HERR ist mein Hirt: mir mangelt nichts.
            </p>
            <p class="mt-1 font-display text-sm text-muted-foreground">Psalm 23,1</p>
        </template>

        <!-- Lieder zum Kapitel: below the chapter, the hymns that cite it. -->
        <template v-else-if="feature === 'lieder'">
            <p class="label-micro text-muted-foreground">Lieder zu diesem Kapitel</p>
            <p class="mt-1.5 flex items-baseline gap-2 text-sm">
                <Music2 class="size-3.5 shrink-0 self-center text-gold" />
                <span class="number-display">123.</span>
                <span class="font-display text-[15px]">Der Herr ist mein getreuer Hirt</span>
            </p>
            <p class="ml-[22px] text-xs text-muted-foreground">Psalm 23 · der gute Hirte</p>
        </template>

        <!-- Vorlesen: the verse being read, and the bar that holds it. -->
        <template v-else-if="feature === 'vorlesen'">
            <p class="bibel-chapter font-hymnal text-[15px] leading-relaxed">
                <span class="bibel-verse number-display">1</span>
                <span class="bibel-marked">Der HERR ist mein Hirt: mir mangelt nichts.</span>
            </p>
            <div
                class="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
                <Volume2 class="size-4 text-gold" />
                <span class="mr-auto">Liest Psalm 23,1</span>
                <Pause class="size-4" />
                <X class="size-4" />
            </div>
        </template>

        <p class="mt-2.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Pointer class="mt-px size-3.5 shrink-0" />
            <span>{{ HOW[feature] }}</span>
        </p>
    </div>
</template>

<script setup lang="ts">
import { type Component } from 'vue';

import {
    Bookmark,
    Church,
    CircleCheck,
    Copy,
    Highlighter,
    Music2,
    NotebookPen,
    Pause,
    Pointer,
    Share2,
    Volume2,
    X,
} from 'lucide-vue-next';

import '@/components/bibel/bibel-marks.css';
import '@/components/bibel/bibel-words.css';

import type { BibelFeatures } from '@/db';

defineProps<{
    /** A feature's switch, or 'lesen' for what the reader always does. */
    feature: keyof BibelFeatures | 'lesen';
    /** The feature is switched off: the sample is shown faded. */
    off?: boolean;
}>();

const ACTIONS: { label: string; icon: Component }[] = [
    { label: 'Kopieren', icon: Copy },
    { label: 'Teilen', icon: Share2 },
    { label: 'Markieren', icon: Highlighter },
    { label: 'Gottesdienst', icon: Church },
];

const COLORS = ['gelb', 'gruen', 'blau', 'rosa'] as const;

// The one gesture that reaches each feature — what the sample cannot show.
const HOW: Record<keyof BibelFeatures | 'lesen', string> = {
    lesen: 'Auf den Text eines Verses tippen wählt ihn aus (weitere Verse dazu tippen); unten erscheinen Kopieren, Teilen, Gottesdienst und Playlist. Auf den Kapiteltitel tippen öffnet alle Bücher und Kapitel, seitlich wischen blättert.',
    fortschritt:
        'Am Ende jedes Kapitels „Als gelesen markieren“ tippen. Einen Leseplan wählen Sie im Bibel-Reiter unter „Lesepläne“; er hakt jeden Tag von selbst ab.',
    lesezeichen:
        'Auf die Versnummer tippen setzt das Lesezeichen, noch einmal tippen nimmt es weg. Oder im Kapitel oben rechts ⚙ → „Lesezeichen“.',
    notizen:
        'Auf den Text eines Verses tippen, dann unten „Markieren“ (vier Farben) oder „Notiz“. Alle stehen im Bibel-Reiter unter „Notizen & Markierungen“.',
    versDerWoche:
        'Jede Woche ein anderer Vers, oben im Bibel-Reiter. Antippen öffnet ihn im Zusammenhang.',
    lieder: 'Unter jedem Kapitel, aus Ihrem Gesangbuch. Antippen öffnet das Lied.',
    vorlesen:
        'Im Kapitel oben rechts ⚙ → „Vorlesen“. Es liest ab dem Vers oben auf dem Bildschirm; anhalten und beenden unten.',
};
</script>
