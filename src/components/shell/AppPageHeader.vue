<template>
    <header
        class="z-20 shrink-0 border-b border-border bg-background pt-[env(safe-area-inset-top)]"
    >
        <div class="page-col flex h-14 items-center gap-1">
            <slot name="leading" />
            <h1 class="min-w-0 flex-1 truncate font-display text-xl font-semibold">
                <slot>{{ title }}</slot>
            </h1>
            <slot name="trailing" />
        </div>
    </header>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>();
</script>
