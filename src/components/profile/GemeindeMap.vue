<template>
    <!-- For the eye only: it follows the choice and takes no input, so a screen reader
         has nothing to learn from it that the list does not say. A share of the
         screen rather than rem, because it must leave room for the rows when the
         type is at 200%. -->
    <div class="relative h-[30dvh]" aria-hidden="true">
        <svg :viewBox="viewBox" class="gemeinde-map block size-full rounded-lg">
            <path
                :d="OUTLINE"
                class="fill-muted stroke-muted-foreground/40 [vector-effect:non-scaling-stroke]"
                stroke-width="1"
                stroke-linejoin="round"
            />
            <circle
                v-if="selected?.point"
                :cx="selected.point.x"
                :cy="selected.point.y"
                :r="HALO_RADIUS / camera.zoom"
                class="fill-primary/15"
            />
            <circle
                v-for="gemeinde in pins"
                :key="gemeinde.id"
                :cx="gemeinde.point!.x"
                :cy="gemeinde.point!.y"
                :r="(gemeinde.id === selected?.id ? SELECTED_RADIUS : PIN_RADIUS) / camera.zoom"
                :class="[
                    'stroke-background [vector-effect:non-scaling-stroke]',
                    gemeinde.id === selected?.id ? 'fill-primary' : 'fill-muted-foreground',
                ]"
                stroke-width="1.5"
            />
        </svg>
        <p
            v-if="selected"
            class="absolute bottom-1 left-0 max-w-full truncate rounded-sm bg-popover/90 px-2 py-0.5 text-sm font-medium"
        >
            {{ selected.name }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';

import {
    type GemeindeOption,
    type MapCamera,
    cameraOn,
    germanyPath,
    stepCamera,
    viewBoxOf,
} from '@/utils/gemeinden';
import { prefersReducedMotion } from '@/utils/motion';

const props = defineProps<{
    gemeinden: GemeindeOption[];
    /** The chosen one; the whole country for none. */
    selected: GemeindeOption | null;
}>();

const OUTLINE = germanyPath();

// In map units at full view. Divided by the zoom when drawn, so a pin stays the
// same size on the screen while the map closes in around it.
const PIN_RADIUS = 12;
const SELECTED_RADIUS = 18;
const HALO_RADIUS = 44;

// The chosen one last, so it is not drawn under a neighbour.
const pins = computed(() =>
    props.gemeinden
        .filter(({ point }) => point)
        .sort((a, b) => Number(a.id === props.selected?.id) - Number(b.id === props.selected?.id)),
);

const target = computed(() => cameraOn(props.selected?.point ?? null));
const camera = shallowRef<MapCamera>(target.value);
const viewBox = computed(() => viewBoxOf(camera.value));

let frame = 0;
let previous = 0;

function tick(now: number) {
    camera.value = stepCamera(camera.value, target.value, now - previous);
    previous = now;
    frame = camera.value === target.value ? 0 : requestAnimationFrame(tick);
}

watch(target, (to) => {
    if (prefersReducedMotion()) {
        camera.value = to;
    } else if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
    }
});

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>
