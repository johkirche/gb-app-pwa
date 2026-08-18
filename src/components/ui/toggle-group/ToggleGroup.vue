<template>
    <ToggleGroupRoot
        v-bind="forwardedProps"
        :class="cn('inline-flex items-center rounded-lg bg-muted p-0.5', props.class)"
        @update:model-value="onUpdateModelValue"
    >
        <slot />
    </ToggleGroupRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    type AcceptableValue,
    ToggleGroupRoot,
    type ToggleGroupRootEmits,
    type ToggleGroupRootProps,
    useForwardProps,
} from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends ToggleGroupRootProps {
    class?: string;
    /**
     * Keep the current value when the active item is re-clicked. reka-ui deselects on
     * re-click (emitting `undefined`), but a segment control must never go empty — so this
     * defaults to `true`. Pass `:prevent-deselect="false"` for genuinely deselectable groups.
     */
    preventDeselect?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    type: 'single',
    preventDeselect: true,
    class: undefined,
});

const emits = defineEmits<ToggleGroupRootEmits>();

const delegatedProps = computed(() => {
    const { class: _, preventDeselect: _preventDeselect, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);

// reka-ui has no built-in prevent-deselect (its `required` prop is form validation only,
// verified against reka-ui 2.10 types/impl), so guard here: swallow empty updates.
function onUpdateModelValue(payload: AcceptableValue | AcceptableValue[] | undefined) {
    const isEmpty =
        payload === undefined ||
        payload === null ||
        (Array.isArray(payload) && payload.length === 0);
    if (props.preventDeselect && isEmpty) {
        return;
    }
    emits('update:modelValue', payload as AcceptableValue | AcceptableValue[]);
}
</script>
