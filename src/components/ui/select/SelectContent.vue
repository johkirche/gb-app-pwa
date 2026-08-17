<template>
    <SelectPortal>
        <SelectContent
            v-bind="{ ...forwarded, ...$attrs }"
            :class="
                cn(
                    'relative z-50 max-h-(--reka-select-content-available-height) min-w-32 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg',
                    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                    'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                    position === 'popper' &&
                        'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
                    props.class,
                )
            "
        >
            <SelectScrollUpButton />
            <SelectViewport
                :class="
                    cn(
                        'p-1',
                        position === 'popper' &&
                            'h-(--reka-select-trigger-height) w-full min-w-(--reka-select-trigger-width)',
                    )
                "
            >
                <slot />
            </SelectViewport>
            <SelectScrollDownButton />
        </SelectContent>
    </SelectPortal>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    SelectContent,
    type SelectContentEmits,
    type SelectContentProps,
    SelectPortal,
    SelectViewport,
    useForwardPropsEmits,
} from 'reka-ui';

import { cn } from '@/lib/utils';

import SelectScrollDownButton from './SelectScrollDownButton.vue';
import SelectScrollUpButton from './SelectScrollUpButton.vue';

defineOptions({ inheritAttrs: false });

interface Props extends SelectContentProps {
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    position: 'popper',
    sideOffset: 4,
});
const emits = defineEmits<SelectContentEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>
