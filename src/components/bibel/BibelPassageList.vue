<template>
    <!-- Passages kept beside the songs of a playlist. A section of its own
         under the songs, not rows among them: the song list and everything
         built on it stays about songs. (The Gottesdienst interleaves them —
         see ServiceItemsList.) -->
    <section v-if="passages.length > 0" class="mt-6" :aria-labelledby="headingId">
        <h2 :id="headingId" class="label-micro mb-1 px-2 text-muted-foreground">
            {{ heading }}
        </h2>
        <VueDraggable
            :model-value="passages"
            tag="ol"
            class="divide-y divide-border"
            handle="[data-drag-handle]"
            :disabled="!reorderMode"
            :animation="150"
            @update:model-value="handleReorder"
        >
            <li
                v-for="passage in passages"
                :key="passageKey(passage)"
                class="flex items-center pr-2"
                :class="reorderMode ? '' : 'rounded-sm transition-colors hover:bg-muted'"
            >
                <component
                    :is="reorderMode ? 'div' : RouterLink"
                    :to="reorderMode ? undefined : passagePath(passage)"
                    class="flex min-w-0 flex-1 select-none items-start gap-3 py-3 pl-2"
                >
                    <BookOpen
                        class="mt-0.5 size-[1.125rem] shrink-0 text-gold"
                        aria-hidden="true"
                    />
                    <span class="min-w-0 flex-1">
                        <span class="block text-[0.9375rem] font-medium leading-tight">
                            {{ passageLabel(passage) }}
                        </span>
                        <span
                            v-if="snippets[passageKey(passage)]"
                            class="mt-0.5 line-clamp-2 text-sm text-muted-foreground"
                        >
                            {{ snippets[passageKey(passage)] }}
                        </span>
                    </span>
                    <span
                        v-if="reorderMode"
                        data-drag-handle
                        class="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
                    >
                        <GripVertical class="size-5" aria-hidden="true" />
                    </span>
                </component>
                <Button
                    v-if="!reorderMode"
                    variant="ghost"
                    size="icon"
                    class="shrink-0"
                    :aria-label="`${passageLabel(passage)} entfernen`"
                    @click="emit('remove', passageKey(passage))"
                >
                    <X class="!size-[1.125rem] text-muted-foreground" aria-hidden="true" />
                </Button>
            </li>
        </VueDraggable>
    </section>
</template>

<script setup lang="ts">
import { useId } from 'vue';

import { BookOpen, GripVertical, X } from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';
import { RouterLink } from 'vue-router';

import { usePassageSnippets } from '@/composables/usePassageSnippets';

import { Button } from '@/components/ui/button';

import type { BibelPassage } from '@/db';
import { passageKey, passageLabel, passagePath } from '@/utils/bibelPassage';

const props = defineProps<{
    passages: BibelPassage[];
    heading: string;
    reorderMode: boolean;
}>();

const emit = defineEmits<{
    /** The passageKey of the one to take off. */
    remove: [key: string];
    /** Every rendered passageKey, in the new order. */
    reorder: [keys: string[]];
}>();

const headingId = useId();
const snippets = usePassageSnippets(() => props.passages);

function handleReorder(reordered: BibelPassage[]) {
    emit('reorder', reordered.map(passageKey));
}
</script>
