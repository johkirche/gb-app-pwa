<template>
    <SelectItem
        v-bind="forwarded"
        :class="
            cn(
                'relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pr-8 pl-2 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                props.class,
            )
        "
    >
        <span class="absolute right-2 flex size-4 items-center justify-center">
            <SelectItemIndicator>
                <Check class="size-4" aria-hidden="true" />
            </SelectItemIndicator>
        </span>
        <SelectItemText>
            <slot />
        </SelectItemText>
    </SelectItem>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Check } from 'lucide-vue-next';
import {
    SelectItem,
    type SelectItemEmits,
    SelectItemIndicator,
    type SelectItemProps,
    SelectItemText,
    useForwardPropsEmits,
} from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SelectItemProps {
    class?: string;
}

const props = defineProps<Props>();
const emits = defineEmits<SelectItemEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>
