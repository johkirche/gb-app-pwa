<template>
    <div>
        <!-- A reader who put the book off for WLAN has said what they think of
             mobile data; the roundels wait to be asked for too. The list
             itself is a few hundred bytes and says what the set weighs. -->
        <div v-if="waiting" class="flex flex-col items-start gap-3">
            <p class="text-sm leading-relaxed text-muted-foreground">
                Die Symbole werden erst geladen, wenn Sie sie sehen möchten.
            </p>
            <Button type="button" variant="outline" @click="consented = true">
                <Images aria-hidden="true" />
                Symbole laden
                <template v-if="totalBytes">· ca. {{ formatBytes(totalBytes) }}</template>
            </Button>
        </div>

        <div v-else-if="listState === 'error'" class="flex flex-col items-start gap-3">
            <p class="text-sm leading-relaxed text-muted-foreground">
                Die Symbole konnten gerade nicht geladen werden.
            </p>
            <Button type="button" variant="outline" @click="load">
                <RotateCw aria-hidden="true" />
                Symbole erneut laden
            </Button>
        </div>

        <template v-else>
            <!-- auto-fill on a rem minimum: at Größe 200 % the roundels keep
                 their size and the grid takes fewer of them a row, instead of
                 shrinking them to fit five. -->
            <RadioGroupRoot
                :model-value="modelValue ?? NONE"
                aria-label="Symbol"
                loop
                class="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-3"
                @update:model-value="onPick"
            >
                <RadioGroupItem :value="NONE" aria-label="Ohne Symbol" :class="tile">
                    <UserAvatar :initials="initials" class="size-full text-[1.125rem]" />
                </RadioGroupItem>
                <RadioGroupItem
                    v-for="symbol in symbols"
                    :key="symbol.id"
                    :value="symbol.id"
                    :aria-label="symbol.label"
                    :title="symbol.label"
                    :class="tile"
                >
                    <img
                        v-if="images[symbol.id]"
                        :src="images[symbol.id]"
                        alt=""
                        class="size-full animate-in rounded-full fade-in"
                        draggable="false"
                    />
                    <span v-else class="size-full animate-pulse rounded-full bg-muted" />
                </RadioGroupItem>
                <!-- While the list is on its way: the grid's shape, not a spinner. -->
                <template v-if="listState !== 'ready'">
                    <span
                        v-for="n in 11"
                        :key="`placeholder-${n}`"
                        class="aspect-square animate-pulse rounded-full bg-muted"
                        aria-hidden="true"
                    />
                </template>
            </RadioGroupRoot>

            <p
                class="mt-4 min-h-[1.5em] text-sm text-muted-foreground"
                aria-live="polite"
                aria-atomic="true"
            >
                <template v-if="chosen">
                    Gewählt:
                    <span class="text-foreground">{{ chosen.label }}</span>
                </template>
                <template v-else-if="modelValue === null">
                    Ohne Symbol – es werden Ihre Initialen gezeigt.
                </template>
            </p>
            <p v-if="imagesFailed" class="text-sm text-muted-foreground">
                Einige Symbole fehlen noch.
                <button
                    type="button"
                    class="font-medium text-primary underline-offset-4 hover:underline"
                    @click="load"
                >
                    Erneut laden
                </button>
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Images, RotateCw } from 'lucide-vue-next';
import { type AcceptableValue, RadioGroupItem, RadioGroupRoot } from 'reka-ui';

import { useSymbols } from '@/composables/useSymbols';

import UserAvatar from '@/components/profile/UserAvatar.vue';
import { Button } from '@/components/ui/button';

import { formatBytes } from '@/services/storage';

const props = defineProps<{
    /** The chosen symbol's file id; null for none. */
    modelValue: string | null;
    /** What the „Ohne Symbol" tile shows instead. */
    initials: string;
    /** Hold the roundels back until the reader asks for them (mobile data). */
    askFirst?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

/** The radio value for „no symbol" — a file id is a UUID, so it cannot be one. */
const NONE = 'none';

const tile =
    'aspect-square rounded-full ring-offset-2 ring-offset-background transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring data-[state=checked]:ring-3 data-[state=checked]:ring-primary';

const { symbols, listState, images, imagesFailed, totalBytes, loadList, loadAll } = useSymbols();

const consented = ref(false);
const waiting = computed(() => props.askFirst && !consented.value);

const chosen = computed(() => symbols.value.find((s) => s.id === props.modelValue) ?? null);

function onPick(value: AcceptableValue) {
    emit('update:modelValue', value === NONE || typeof value !== 'string' ? null : value);
}

function load() {
    void loadAll();
}

onMounted(() => {
    if (waiting.value) void loadList();
    else load();
});

watch(consented, (yes) => {
    if (yes) load();
});
</script>
