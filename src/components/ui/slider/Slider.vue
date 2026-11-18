<template>
    <SliderRoot
        v-slot="{ modelValue: currentValue }"
        v-bind="forwarded"
        :class="
            cn(
                'relative flex w-full cursor-pointer touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
                props.class,
            )
        "
    >
        <SliderTrack
            class="relative h-1 w-full grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
        >
            <SliderRange
                class="absolute h-full bg-primary data-[orientation=vertical]:h-auto data-[orientation=vertical]:w-full"
            />
        </SliderTrack>
        <!-- The thumb is what carries role="slider", so it is what needs the name;
             an aria-label given to the slider would otherwise stay on the root,
             where nothing reads it. -->
        <SliderThumb
            v-for="(_, index) in currentValue ?? []"
            :key="index"
            :aria-label="thumbLabel"
            class="block size-4 rounded-full border border-primary bg-card shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        />
    </SliderRoot>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import {
    SliderRange,
    SliderRoot,
    type SliderRootEmits,
    type SliderRootProps,
    SliderThumb,
    SliderTrack,
    useForwardPropsEmits,
} from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SliderRootProps {
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    class: undefined,
});

const emits = defineEmits<SliderRootEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const attrs = useAttrs();
const thumbLabel = computed(() => {
    const label = attrs['aria-label'];
    return typeof label === 'string' ? label : undefined;
});
</script>
