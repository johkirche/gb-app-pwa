<template>
    <div class="mb-8 flex justify-center">
        <div class="inline-flex flex-col items-start">
            <template v-for="(strophe, idx) in strophes" :key="idx">
                <div v-if="!(skipFirst && idx === 0)" class="mb-6 flex items-baseline gap-3">
                    <span class="verse-number number-display min-w-6 shrink-0">{{ idx + 1 }}.</span>
                    <div class="flex flex-col">
                        <p class="verse-text m-0 whitespace-pre-line font-display text-foreground">
                            {{ verseText(strophe) }}
                        </p>
                        <p
                            v-if="strophe.anmerkung"
                            class="verse-note mt-1 italic text-muted-foreground"
                        >
                            {{ strophe.anmerkung }}
                        </p>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Strophe {
    text?: string | { strophe?: string };
    strophe?: string;
    anmerkung?: string | null;
}

defineProps<{
    strophes: Strophe[];
    /**
     * Leave out verse 1 because the notation on screen already carries it
     * under its notes. The remaining verses keep their real numbers — the
     * list is numbered from the index, not from its own position.
     */
    skipFirst?: boolean;
}>();

function getStropheText(strophe: Strophe): string | null | undefined {
    if (typeof strophe.text === 'object') {
        return strophe.text?.strophe;
    }
    return strophe.text || strophe.strophe;
}

// The stored verses carry their own line breaks (one line per sung line),
// which `whitespace: pre-line` on .verse-text keeps. Rendering as text rather
// than markup means a break can never be lost to HTML collapsing, and the CMS
// field is never interpreted as HTML.
function verseText(strophe: Strophe): string {
    const text = getStropheText(strophe);
    if (typeof text !== 'string') return '';
    // ¬ marks a syllable break for the engraver, never for the reader
    return text.replace(/¬/g, '').trim();
}
</script>

<style scoped>
/* Live text-size contract: the parent (.song-content.text-size-*) provides
   --verse-font-size / --verse-line-height so the popover's Textgröße setting
   updates the verses without re-render. */
.verse-number,
.verse-text {
    font-size: var(--verse-font-size, 1.125rem);
    line-height: var(--verse-line-height, 1.6);
}

/* Per-verse note (anmerkung): slightly smaller than the verse itself */
.verse-note {
    font-size: calc(var(--verse-font-size, 1.125rem) * 0.85);
    line-height: var(--verse-line-height, 1.6);
}
</style>
