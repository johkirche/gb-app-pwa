<template>
    <input
        v-model="model"
        :class="
            cn(
                'flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
                props.class,
            )
        "
    />
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    class: undefined,
});

const model = defineModel<string | number>();
</script>
