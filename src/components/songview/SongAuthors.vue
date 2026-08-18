<template>
    <div v-if="footerLines.length > 0" class="mt-6 border-t border-border pt-6">
        <div v-for="(line, idx) in footerLines" :key="idx" class="mb-2 flex items-start gap-2">
            <component
                :is="line.icon"
                v-if="line.icon"
                class="mt-0.5 size-[18px] shrink-0 text-muted-foreground"
                aria-hidden="true"
            />
            <span :class="line.isCopyright ? 'text-sm text-muted-foreground' : 'text-foreground'">
                {{ line.text }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';

import { FileText, Music2 } from 'lucide-vue-next';

import type { Song } from '@/db';
import { buildFooter } from '@/utils/authorFormat';

const props = defineProps<{
    song: Song;
}>();

function lineIcon(line: string): Component | null {
    if (line.startsWith('Text:')) return FileText;
    if (line.startsWith('Melodie:') || line.startsWith('Text und Melodie:')) {
        return Music2;
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
