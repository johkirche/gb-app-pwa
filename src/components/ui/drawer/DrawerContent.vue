<template>
    <DrawerPortal>
        <DrawerOverlay />
        <VaulDrawerContent
            :class="
                cn(
                    'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl border-t bg-popover text-popover-foreground shadow-lg outline-none',
                    'pb-[env(safe-area-inset-bottom)]',
                    // Desktop: keep the bottom sheet a centered column instead of viewport-wide
                    'sm:mx-auto sm:w-full sm:max-w-md sm:rounded-t-xl sm:border-x',
                    props.class,
                )
            "
        >
            <div
                class="mx-auto mt-3 h-1.5 w-10 shrink-0 cursor-grab rounded-full bg-muted active:cursor-grabbing"
                aria-hidden="true"
            />
            <div class="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                <slot />
            </div>
        </VaulDrawerContent>
    </DrawerPortal>
</template>

<script setup lang="ts">
import { DrawerPortal, DrawerContent as VaulDrawerContent } from 'vaul-vue';

import { cn } from '@/lib/utils';

import DrawerOverlay from './DrawerOverlay.vue';

interface Props {
    class?: string;
}

const props = defineProps<Props>();
</script>
