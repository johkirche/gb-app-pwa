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
            @pointercancel="releaseStrandedDrag"
        >
            <div
                class="mx-auto mt-3 h-1.5 w-10 shrink-0 cursor-grab rounded-full bg-muted active:cursor-grabbing"
                aria-hidden="true"
            />
            <div
                ref="body"
                class="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
                @touchstart.passive="onTouchStart"
                @touchmove="onTouchMove"
            >
                <slot />
            </div>
        </VaulDrawerContent>
    </DrawerPortal>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { DrawerPortal, DrawerContent as VaulDrawerContent } from 'vaul-vue';

import { cn } from '@/lib/utils';

import DrawerOverlay from './DrawerOverlay.vue';

interface Props {
    class?: string;
}

const props = defineProps<Props>();

/**
 * Everything below the handle is the sheet's own scroll container, and a
 * vertical touch that starts there is one the browser claims for that
 * container: it fires `pointercancel` at vaul a few pixels in, which is why the
 * sheet used to twitch and then stick instead of following the finger. Only the
 * handle strip, outside the scroller, ever dragged.
 *
 * So decide, on the first move of each gesture, whether it belongs to the sheet
 * — and if it does, prevent the touch, which is what stops the browser starting
 * a scroll and keeps vaul's pointer stream alive to the release. The test
 * mirrors vaul's own `shouldDrag` so the two never disagree about a gesture.
 */
const body = ref<HTMLElement | null>(null);

/** Where the finger went down, and whether this gesture is the sheet's. */
let touchStartY = 0;
let sheetHasGesture = false;

function onTouchStart(event: TouchEvent) {
    sheetHasGesture = false;
    touchStartY = event.touches[0].clientY;
}

function onTouchMove(event: TouchEvent) {
    // A second finger means something other than a drag — a pinch on a page of
    // notation — and the sheet wants no part of it.
    if (event.touches.length !== 1) return;

    if (!sheetHasGesture) {
        if (!belongsToSheet(event)) return;
        sheetHasGesture = true;
    }

    // Once the sheet has a gesture it keeps it for the rest of the stroke, so
    // dragging back up puts the sheet home rather than scrolling the body out
    // from under it.
    if (event.cancelable) event.preventDefault();
}

function belongsToSheet(event: TouchEvent): boolean {
    const scroller = body.value;
    if (!scroller) return false;

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-vaul-no-drag]')) return false;

    // A sheet resting below its full height — parked on a snap point — follows
    // the finger either way, since that is how it changes size.
    if (translateY(scroller) > 0) return true;

    // At full height only a downward pull counts, and only while nothing under
    // the finger has been scrolled away from its top.
    const pullingDown = event.touches[0].clientY > touchStartY;
    return pullingDown && restsAtTop(target, scroller);
}

/** How far vaul currently holds the sheet below where it would otherwise sit. */
function translateY(scroller: HTMLElement): number {
    const sheet = scroller.closest('[data-vaul-drawer]');
    if (!sheet) return 0;

    return new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42;
}

/** Whether every scroller between the touch and the sheet's body is at its top. */
function restsAtTop(target: Element | null, scroller: HTMLElement): boolean {
    for (let el = target; el; el = el.parentElement) {
        if (el.scrollTop > 0) return false;
        if (el === scroller) break;
    }

    return true;
}

/**
 * A gesture the browser takes back part-way — a system swipe, a second finger —
 * leaves vaul waiting on a release that will never arrive, and the sheet
 * stranded wherever the finger left it. Hand it the release it is waiting for,
 * so the sheet snaps home or closes the way letting go would.
 */
function releaseStrandedDrag(event: PointerEvent) {
    event.target?.dispatchEvent(
        new PointerEvent('pointerup', {
            bubbles: true,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            clientX: event.clientX,
            clientY: event.clientY,
        }),
    );
}
</script>
