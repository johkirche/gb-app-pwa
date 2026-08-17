<template>
    <DialogPortal>
        <Overlay />
        <DialogContent
            v-bind="forwarded"
            :class="
                cn(
                    'fixed left-1/2 top-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-popover p-6 text-popover-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 sm:max-w-lg',
                    props.class,
                )
            "
        >
            <slot />

            <DialogClose
                class="absolute right-4 top-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none"
                aria-label="Schließen"
            >
                <X class="size-4" />
            </DialogClose>
        </DialogContent>
    </DialogPortal>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { X } from 'lucide-vue-next';
import {
    DialogClose,
    DialogContent,
    type DialogContentEmits,
    type DialogContentProps,
    DialogPortal,
    useForwardPropsEmits,
} from 'reka-ui';

import { cn } from '@/lib/utils';

import Overlay from './DialogOverlay.vue';

interface Props extends DialogContentProps {
    class?: string;
}

const props = defineProps<Props>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>
