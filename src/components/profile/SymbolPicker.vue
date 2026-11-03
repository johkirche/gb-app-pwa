<template>
    <div>
        <!-- A reader who put the book off for WLAN has said what they think of
             mobile data; the roundels wait to be asked for too. The list
             itself is a few hundred bytes and says what the set weighs. -->
        <div v-if="waiting" class="flex flex-col items-start gap-3">
            <p class="text-sm leading-relaxed text-muted-foreground">
                Die Symbole laden wir nur, wenn Sie sie sehen möchten.
            </p>
            <Button type="button" variant="outline" @click="consented = true">
                <Images aria-hidden="true" />
                Symbole laden
                <template v-if="totalBytes">(ca. {{ formatBytes(totalBytes) }})</template>
            </Button>
        </div>

        <div v-else-if="listState === 'error'" class="flex flex-col items-start gap-3">
            <p class="text-sm leading-relaxed text-muted-foreground">
                Die Symbole konnten nicht geladen werden.
            </p>
            <Button type="button" variant="outline" @click="load">
                <RotateCw aria-hidden="true" />
                Symbole erneut laden
            </Button>
        </div>

        <template v-else>
            <!-- The choice, kept in sight: the grid runs longer than a phone,
                 and by halfway down it the step's large picture has scrolled
                 away. Sticky against whatever scrolls the picker, so it needs
                 that surface's own background. -->
            <div
                class="sticky top-0 z-10 mb-3 flex items-center gap-4 py-2"
                :class="surface === 'popover' ? 'bg-popover' : 'bg-background'"
            >
                <UserAvatar :src="chosenSrc" :initials="initials" class="size-14 text-[1.25rem]" />
                <p class="min-w-0 text-[0.9375rem]" aria-live="polite" aria-atomic="true">
                    {{ chosenLabel }}
                </p>
            </div>

            <!-- auto-fill on a rem minimum: four a row on a phone, and at
                 Größe 200 % the roundels keep their size and the grid takes
                 fewer of them a row instead of shrinking them to fit. -->
            <RadioGroupRoot
                :model-value="modelValue ?? NONE"
                aria-label="Symbol"
                loop
                class="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-3"
                @update:model-value="onPick"
            >
                <RadioGroupItem :value="NONE" aria-label="Ohne Symbol" :class="tile">
                    <UserAvatar :initials="initials" class="size-full text-[1.375rem]" />
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
                        v-for="n in 7"
                        :key="`placeholder-${n}`"
                        class="aspect-square animate-pulse rounded-full bg-muted"
                        aria-hidden="true"
                    />
                </template>
            </RadioGroupRoot>

            <p v-if="imagesFailed" class="mt-4 text-sm text-muted-foreground">
                Einige Symbole konnten nicht geladen werden.
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

import { useUserStore } from '@/stores/user';

import { useProfile } from '@/composables/useProfile';
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
    /** What the picker sits on, for the sticky preview's background. */
    surface?: 'background' | 'popover';
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

/** The radio value for „no symbol" — a file id is a UUID, so it cannot be one. */
const NONE = 'none';

const tile =
    'aspect-square rounded-full ring-offset-2 ring-offset-background transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring data-[state=checked]:ring-3 data-[state=checked]:ring-primary';

const { symbols, listState, images, imagesFailed, totalBytes, loadList, loadAll } = useSymbols();

const consented = ref(false);
const waiting = computed(() => props.askFirst && !consented.value);

const userStore = useUserStore();
const { avatarUrl } = useProfile();

const chosen = computed(() => symbols.value.find((s) => s.id === props.modelValue) ?? null);

// The account's own symbol is on the device before the grid has loaded it.
const chosenSrc = computed(() => {
    if (!props.modelValue) return null;
    return (
        images[props.modelValue] ??
        (props.modelValue === userStore.user?.avatar ? avatarUrl.value : null)
    );
});

const chosenLabel = computed(() => {
    if (props.modelValue === null) return 'Ohne Symbol';
    return chosen.value?.label ?? '';
});

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
