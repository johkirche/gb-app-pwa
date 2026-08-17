<template>
    <DropdownMenuItem
        v-bind="forwarded"
        :data-variant="props.variant"
        :class="
            cn(
                'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                props.variant === 'destructive' &&
                    'text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive',
                props.class,
            )
        "
    >
        <slot />
    </DropdownMenuItem>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    DropdownMenuItem,
    type DropdownMenuItemEmits,
    type DropdownMenuItemProps,
    useForwardPropsEmits,
} from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends DropdownMenuItemProps {
    class?: string;
    variant?: 'default' | 'destructive';
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'default',
});
const emits = defineEmits<DropdownMenuItemEmits>();

const delegatedProps = computed(() => {
    const { class: _, variant: __, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>
