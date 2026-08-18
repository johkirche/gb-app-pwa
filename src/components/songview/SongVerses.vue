<template>
    <div class="mb-8 flex justify-center">
        <div class="inline-flex flex-col items-start">
            <template v-for="(strophe, idx) in strophes" :key="idx">
                <div v-if="!(skipFirst && idx === 0)" class="mb-6 flex items-baseline gap-3">
                    <span class="verse-number number-display min-w-6 shrink-0">{{ idx + 1 }}.</span>
                    <div class="flex flex-col">
                        <p
                            class="verse-text m-0 font-display text-foreground"
                            v-html="formatVerse(getStropheText(strophe))"
                        ></p>
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
    skipFirst?: boolean;
}>();

function getStropheText(strophe: Strophe): string | null | undefined {
    if (typeof strophe.text === 'object') {
        return strophe.text?.strophe;
    }
    return strophe.text || strophe.strophe;
}

function formatVerse(text: string | null | undefined): string {
    if (typeof text !== 'string') return '';
    // remove ¬ from text
    text = text.replace(/¬/g, '');
    return text.replace(/\n/g, '<br>');
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
