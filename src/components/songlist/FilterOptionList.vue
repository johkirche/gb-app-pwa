<template>
    <div class="flex min-h-0 flex-1 flex-col">
        <!-- Quick-search, pinned above the scrolling list -->
        <div class="shrink-0 px-4 pb-3">
            <div class="flex cursor-text items-center gap-2 rounded-lg bg-muted px-3">
                <Search class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                    v-model="query"
                    type="text"
                    class="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
                    :placeholder="searchPlaceholder"
                />
                <button
                    v-if="query"
                    type="button"
                    class="inline-flex shrink-0 text-muted-foreground"
                    aria-label="Suche löschen"
                    @click="query = ''"
                >
                    <CircleX class="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </div>

        <!-- The list is the only thing that scrolls; the search box stays put -->
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
            <template v-for="group in groups" :key="group.key">
                <p
                    v-if="group.title"
                    class="label-micro px-2 pb-1 pt-3 text-muted-foreground first:pt-1"
                >
                    {{ group.title }}
                </p>

                <button
                    v-for="option in group.options"
                    :key="option.value"
                    type="button"
                    role="checkbox"
                    :aria-checked="isSelected(option.value)"
                    class="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted"
                    @click="$emit('toggle', option.value)"
                >
                    <span
                        class="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors"
                        :class="
                            isSelected(option.value)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input'
                        "
                        aria-hidden="true"
                    >
                        <Check v-if="isSelected(option.value)" class="size-3" />
                    </span>

                    <slot name="glyph" :option="option" />

                    <span
                        class="min-w-0 flex-1 truncate text-[15px] leading-tight"
                        :class="isSelected(option.value) ? 'font-medium' : undefined"
                    >
                        {{ option.label }}
                    </span>

                    <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {{ option.count }}
                    </span>
                </button>
            </template>

            <p v-if="!groups.length" class="py-10 text-center text-sm text-muted-foreground">
                {{ options.length ? noMatchLabel : emptyLabel }}
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Check, CircleX, Search } from 'lucide-vue-next';

import type { FilterOption } from '@/composables/useSongFiltering';

const props = defineProps<{
    options: FilterOption[];
    selected: string[];
    searchPlaceholder: string;
    /** Shown when the search matched nothing. */
    noMatchLabel: string;
    /** Shown when there is nothing to filter by at all. */
    emptyLabel: string;
}>();

defineEmits<{
    (e: 'toggle', value: string): void;
}>();

const query = ref('');

function isSelected(value: string): boolean {
    return props.selected.includes(value);
}

const matches = computed(() => {
    const needle = query.value.trim().toLowerCase();
    if (!needle) return props.options;
    return props.options.filter((option) => option.label.toLowerCase().includes(needle));
});

interface OptionGroup {
    key: string;
    title?: string;
    options: FilterOption[];
}

/**
 * At rest the picked options are lifted to the top, so a selection made
 * somewhere deep in a few hundred rows stays visible — and switchable off —
 * without scrolling for it. While searching the list stays in one piece: the
 * query already tells the reader what they are looking at.
 */
const groups = computed((): OptionGroup[] => {
    const all = matches.value;
    if (!all.length) return [];

    if (query.value.trim() || !props.selected.length) {
        return [{ key: 'all', options: all }];
    }

    const picked = all.filter((option) => isSelected(option.value));
    const rest = all.filter((option) => !isSelected(option.value));

    return [
        ...(picked.length ? [{ key: 'selected', title: 'Ausgewählt', options: picked }] : []),
        ...(rest.length ? [{ key: 'rest', title: 'Alle', options: rest }] : []),
    ];
});
</script>
