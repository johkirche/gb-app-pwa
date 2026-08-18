<template>
    <ProgressRoot
        v-bind="forwarded"
        :class="cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', props.class)"
    >
        <ProgressIndicator
            class="h-full w-full flex-1 bg-primary transition-all"
            :style="{ transform: `translateX(-${100 - percent}%)` }"
        />
    </ProgressRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    ProgressIndicator,
    ProgressRoot,
    type ProgressRootEmits,
    type ProgressRootProps,
    useForwardPropsEmits,
} from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends ProgressRootProps {
    class?: string;
}

// The app feeds 0..1 fractions (current/total), hence max defaults to 1;
// the indicator scales the value to a percentage internally.
const props = withDefaults(defineProps<Props>(), {
    modelValue: 0,
    max: 1,
    class: undefined,
});

const emits = defineEmits<ProgressRootEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const percent = computed(() => {
    const value = props.modelValue ?? 0;
    const max = props.max > 0 ? props.max : 1;
    return Math.min(100, Math.max(0, (value / max) * 100));
});
</script>
