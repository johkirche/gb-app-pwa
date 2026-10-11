<template>
    <!-- One kept verse's face: what it carries, where it is, and the words
         that say why it was kept. The list around it makes it a link, or a
         row to pick out. -->
    <span
        v-if="stelle.color"
        class="mt-1 size-3.5 shrink-0 rounded-full border border-border"
        :style="{ background: `var(--bibel-mark-${stelle.color})` }"
        aria-hidden="true"
    />
    <Bookmark
        v-else-if="stelle.lesezeichen !== undefined"
        class="mt-0.5 size-[1.125rem] shrink-0 fill-current text-gold"
        aria-hidden="true"
    />
    <NotebookPen v-else class="mt-0.5 size-[1.125rem] shrink-0 text-gold" aria-hidden="true" />
    <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5 text-[0.9375rem] font-medium leading-tight">
            <span class="min-w-0">{{ stelleLabel(stelle) }}</span>
            <!-- What else the verse carries, beside what the icon already says. -->
            <Bookmark
                v-if="stelle.color && stelle.lesezeichen !== undefined"
                class="size-[0.875rem] shrink-0 fill-current text-gold"
                aria-label="mit Lesezeichen"
            />
            <NotebookPen
                v-if="(stelle.color || stelle.lesezeichen !== undefined) && stelle.note"
                class="size-[0.875rem] shrink-0 text-gold"
                aria-label="mit Notiz"
            />
        </span>
        <span
            v-if="stelle.note"
            class="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground"
            v-text="stelle.note"
        />
        <span
            v-else-if="stelle.lesezeichen"
            class="mt-0.5 line-clamp-2 text-sm text-muted-foreground"
            v-text="stelle.lesezeichen"
        />
    </span>
</template>

<script setup lang="ts">
import { Bookmark, NotebookPen } from 'lucide-vue-next';

import { type Stelle, stelleLabel } from '@/utils/meineStellen';

import './bibel-marks.css';

defineProps<{ stelle: Stelle }>();
</script>
