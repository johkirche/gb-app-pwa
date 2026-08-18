<template>
    <CheckboxRoot
        v-bind="forwarded"
        :class="
            cn(
                'peer size-4 shrink-0 rounded-sm border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                props.class,
            )
        "
    >
        <CheckboxIndicator class="flex size-full items-center justify-center text-current">
            <Check class="size-3.5" />
        </CheckboxIndicator>
    </CheckboxRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Check } from 'lucide-vue-next';
import {
    CheckboxIndicator,
    CheckboxRoot,
    type CheckboxRootEmits,
    type CheckboxRootProps,
    useForwardPropsEmits,
} from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends CheckboxRootProps {
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    class: undefined,
});

const emits = defineEmits<CheckboxRootEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>
