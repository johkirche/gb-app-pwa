<template>
    <div class="verses-container">
        <div class="verses-section">
            <template v-for="(strophe, idx) in strophes" :key="idx">
                <div v-if="!(skipFirst && idx === 0)" class="verse">
                    <span class="verse-number">{{ idx + 1 }}.</span>
                    <div class="verse-body">
                        <p class="verse-text" v-html="formatVerse(getStropheText(strophe))"></p>
                        <p v-if="strophe.anmerkung" class="verse-note">{{ strophe.anmerkung }}</p>
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
.verses-container {
    display: flex;
    justify-content: center;
    margin-bottom: var(--spacing-xl);
}

.verses-section {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
}

.verse {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
}

.verse-number {
    flex-shrink: 0;
    font-weight: 600;
    color: var(--ion-color-primary);
    min-width: 24px;
    font-size: var(--verse-font-size, var(--font-size-base));
    line-height: var(--verse-line-height, 1.6);
}

.verse-body {
    display: flex;
    flex-direction: column;
}

.verse-text {
    margin: 0;
    font-size: var(--verse-font-size, var(--font-size-base));
    line-height: var(--verse-line-height, 1.6);
    color: var(--ion-color-dark);
}

/* Per-verse note (anmerkung): muted, italic, slightly smaller than the verse */
.verse-note {
    margin: var(--spacing-xs) 0 0;
    font-size: calc(var(--verse-font-size, var(--font-size-base)) * 0.85);
    line-height: var(--verse-line-height, 1.6);
    font-style: italic;
    color: var(--ion-color-medium);
}
</style>
