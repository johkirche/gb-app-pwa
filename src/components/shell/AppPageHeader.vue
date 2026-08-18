<template>
    <header
        class="z-20 shrink-0 border-b border-border bg-background pt-[env(safe-area-inset-top)]"
    >
        <!-- Phone: compact app bar. Desktop: an editorial page header — the
             sidebar already carries the app chrome, so a 56px bar with icon
             buttons would read as a phone UI on a wide screen. -->
        <div class="page-col flex h-14 items-center gap-1 lg:h-auto lg:min-h-24 lg:gap-3 lg:py-6">
            <slot name="leading" />
            <h1
                class="min-w-0 flex-1 truncate font-display text-xl font-semibold lg:line-clamp-2 lg:overflow-visible lg:text-clip lg:whitespace-normal lg:text-[2rem] lg:leading-tight"
            >
                <slot>{{ title }}</slot>
            </h1>
            <slot name="trailing" />
        </div>
    </header>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>();
</script>
