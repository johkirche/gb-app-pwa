<template>
    <!-- Desktop: a panel beside the text — 1.5rem right of the 36rem column,
         which stands in the middle — or, where that would run off the
         screen, at its right edge, the text moving aside to make room (see
         the chapter page), so no verse is covered.
         Clicking further verses adds them; Escape or the ✕ lets go. -->
    <Transition
        v-if="isDesktop"
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-x-4 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-x-4 opacity-0"
    >
        <aside
            v-if="open"
            class="absolute left-[min(calc(50%+19.5rem),calc(100%-21.5rem))] top-4 z-20 flex max-h-[calc(100%-2rem)] w-80 flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
            aria-labelledby="vers-aktionen-titel"
        >
            <div class="flex items-center gap-2 border-b border-border py-2 pl-4 pr-2">
                <div class="min-w-0 flex-1">
                    <h2
                        id="vers-aktionen-titel"
                        class="truncate text-[15px] font-medium"
                        aria-live="polite"
                    >
                        {{ label }}
                    </h2>
                    <p class="text-xs text-muted-foreground">Weitere Verse anklicken</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Auswahl aufheben"
                    @click="selection.clear()"
                >
                    <X class="!size-5" aria-hidden="true" />
                </Button>
            </div>
            <div class="min-h-0 overflow-y-auto px-2">
                <BibelVerseActionList side="left" />
            </div>
        </aside>
    </Transition>

    <!-- Phone: the app's bottom drawer, pulled down — or closed with the ✕ —
         to let go of the verses. Non-modal: no overlay, and the text above
         still scrolls and takes taps, so further verses can be added while it
         is open. One large row per action, its word spelt out: nothing
         hidden, nothing small to aim at. -->
    <Drawer v-else :open="open" :modal="false" @update:open="onOpenChange">
        <DrawerContent non-modal class="max-h-[65dvh]">
            <div class="mx-auto w-full max-w-[36rem] px-3">
                <div class="flex items-center gap-2 border-b border-border pb-2 pl-2">
                    <div class="min-w-0 flex-1">
                        <DrawerTitle class="truncate text-[15px] font-medium" aria-live="polite">
                            {{ label }}
                        </DrawerTitle>
                        <DrawerDescription class="text-xs text-muted-foreground">
                            Weitere Verse antippen
                        </DrawerDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Auswahl aufheben"
                        @click="selection.clear()"
                    >
                        <X class="!size-5" aria-hidden="true" />
                    </Button>
                </div>

                <!-- The drawer scrolls on a short screen, so the text keeps its share. -->
                <BibelVerseActionList />
            </div>
        </DrawerContent>
    </Drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';

import { X } from 'lucide-vue-next';

import { useIsDesktop } from '@/composables/useMediaQuery';
import { useVerseSelection } from '@/composables/useVerseSelection';

import BibelVerseActionList from '@/components/bibel/BibelVerseActionList.vue';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';

import { versesRefLabel } from '@/utils/bibelVerses';

/**
 * The verses picked out in the text, and what can be done with them: the
 * bottom drawer on a phone, a side panel on a desktop. Reads the chapter and
 * the selection from useVerseSelection, so the page mounts it with no props,
 * beside its scroller.
 */

const isDesktop = useIsDesktop();
const selection = useVerseSelection();
const { here, verses } = selection;

const label = computed(() => (here.value ? versesRefLabel(here.value, verses.value) : ''));

/** Open while verses are picked out; pulled down, it lets go of them. */
const open = computed(() => !!here.value && verses.value.length > 0);

function onOpenChange(value: boolean) {
    if (!value) selection.clear();
}

/** Escape lets go of the verses, as it closes any other panel. */
function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented) selection.clear();
}

watch(
    () => open.value && isDesktop.value,
    (listening) => {
        if (listening) window.addEventListener('keydown', onKeydown);
        else window.removeEventListener('keydown', onKeydown);
    },
    { immediate: true },
);
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>
