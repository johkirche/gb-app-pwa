<template>
    <div v-if="footerLines.length > 0" class="authors-section">
        <div v-for="(line, idx) in footerLines" :key="idx" class="author-row">
            <ion-icon v-if="line.icon" :icon="line.icon" />
            <span class="author-line" :class="{ 'copyright-line': line.isCopyright }">
                {{ line.text }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { IonIcon } from '@ionic/vue';
import { documentTextOutline, musicalNoteOutline } from 'ionicons/icons';

import type { Song } from '@/db';
import { buildFooter } from '@/utils/authorFormat';

const props = defineProps<{
    song: Song;
}>();

function lineIcon(line: string): string | null {
    if (line.startsWith('Text:')) return documentTextOutline;
    if (line.startsWith('Melodie:') || line.startsWith('Text und Melodie:')) {
        return musicalNoteOutline;
    }
    // Copyright lines ("© …") get a plain muted row without icon
    return null;
}

// Canonical footer grammar shared with the dashboard (utils/authorFormat):
//   Text: … / Melodie: … / "Text und Melodie: …" when identical, then "© …".
const footerLines = computed(() =>
    buildFooter({
        copyright: props.song.copyright,
        textAutorExtraSuffix: props.song.textAutorExtraSuffix,
        melodieAutorExtraSuffix: props.song.melodieAutorExtraSuffix,
        text: { authors: props.song.textAutoren, copyright: props.song.textCopyright },
        melodie: { authors: props.song.melodieAutoren, copyright: props.song.melodieCopyright },
    })
        .split('\n')
        .filter(Boolean)
        .map((text) => ({
            text,
            icon: lineIcon(text),
            isCopyright: text.startsWith('©'),
        })),
);
</script>

<style scoped>
.authors-section {
    border-top: 1px solid var(--ion-color-light-shade);
    padding-top: var(--spacing-lg);
    margin-top: var(--spacing-lg);
}

.author-row {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
    color: var(--ion-color-medium);
}

.author-row ion-icon {
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 18px;
}

.author-line {
    color: var(--ion-color-dark);
}

.copyright-line {
    color: var(--ion-color-medium);
    font-size: var(--font-size-sm);
}
</style>
