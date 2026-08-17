<template>
    <SliderRoot
        v-slot="{ modelValue: currentValue }"
        v-bind="forwarded"
        :class="
            cn(
                'relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
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
        <SliderThumb
            v-for="(_, index) in currentValue ?? []"
            :key="index"
            class="block size-4 rounded-full border border-primary bg-card shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        />
    </SliderRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue';

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
</script>
