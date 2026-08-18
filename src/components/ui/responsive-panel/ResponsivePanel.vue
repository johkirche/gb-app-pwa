<template>
    <!-- ≥ lg: a popover anchored to whatever opened the panel. -->
    <Popover v-if="isDesktop" :open="open" @update:open="open = $event">
        <PopoverAnchor v-if="anchor" :reference="anchor" class="hidden" />
        <PopoverContent
            :side="side"
            :align="align"
            :collision-padding="12"
            :aria-label="label"
            :class="
                cn(
                    'flex max-h-[min(70vh,var(--reka-popper-available-height))] w-80 flex-col overflow-y-auto overscroll-contain p-0',
                    props.popoverClass,
                )
            "
            @pointer-down-outside="onPointerDownOutside"
        >
            <slot />
        </PopoverContent>
    </Popover>

    <!-- < lg: the bottom sheet, unchanged. Only hand vaul an activeSnapPoint
         when there are snap points — passing one at all switches it from
         uncontrolled to controlled. -->
    <Drawer
        v-else
        :open="open"
        :snap-points="snapPoints"
        :active-snap-point="snapPoints ? activeSnapPoint : undefined"
        @update:active-snap-point="activeSnapPoint = $event"
        @update:open="open = $event"
    >
        <DrawerContent :class="props.drawerClass">
            <slot />
        </DrawerContent>
    </Drawer>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue';

import type { PointerDownOutsideEvent, PopoverContentProps } from 'reka-ui';

import { useIsDesktop } from '@/composables/useMediaQuery';

import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

import type { PanelAnchor } from '@/lib/anchor';
import { cn } from '@/lib/utils';

import { PANEL_CONTEXT } from './context';

interface Props {
    /**
     * Accessible name for the popover form. It duplicates the PanelTitle text
     * because reka names trigger-less popovers with an empty aria-labelledby
     * that would otherwise win. The drawer form is named by its DrawerTitle.
     */
    label: string;
    /** What the popover form positions against. Required on desktop. */
    anchor?: PanelAnchor;
    side?: PopoverContentProps['side'];
    align?: PopoverContentProps['align'];
    popoverClass?: string;
    drawerClass?: string;
    /** Bottom-sheet snap points (drag below the lowest one dismisses). */
    snapPoints?: (number | string)[];
    /** Snap point the sheet reopens at, every time. */
    initialSnapPoint?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
    anchor: null,
    side: 'bottom',
    align: 'end',
    popoverClass: undefined,
    drawerClass: undefined,
    snapPoints: undefined,
    initialSnapPoint: undefined,
});

const open = defineModel<boolean>('open', { required: true });

const isDesktop = useIsDesktop();

provide(PANEL_CONTEXT, {
    surface: computed(() => (isDesktop.value ? 'popover' : 'drawer')),
});

const activeSnapPoint = ref<number | string | null>(props.initialSnapPoint ?? null);

// Reopen at the same snap point every time, however far the user dragged last
watch(open, (isOpen) => {
    if (isOpen) activeSnapPoint.value = props.initialSnapPoint ?? null;
});

/**
 * The control that opened the panel sits outside the popover, so clicking it
 * again would dismiss on pointerdown and immediately re-open on click. Ignore
 * that one pointerdown and let the control's own handler do the toggling.
 * Only real elements get this: a context menu anchored to a click *point*
 * should still close when its row is clicked again.
 */
function onPointerDownOutside(event: PointerDownOutsideEvent) {
    if (!(props.anchor instanceof Element)) return;

    const target = event.detail.originalEvent.target;
    if (target instanceof Node && props.anchor.contains(target)) {
        event.preventDefault();
    }
}
</script>
