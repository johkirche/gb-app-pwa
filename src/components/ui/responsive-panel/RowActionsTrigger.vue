<template>
    <button
        type="button"
        :class="
            cn(
                'hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-border/70 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 lg:flex',
                // Stays lit while its own menu is open — the pointer has left the
                // row for the popover by then, so group-hover no longer holds.
                active ? 'bg-border/70 text-foreground opacity-100' : 'opacity-0',
                props.class,
            )
        "
        :aria-label="label"
        :aria-expanded="active"
        aria-haspopup="menu"
        @click="emit('open', $event.currentTarget as HTMLElement)"
    >
        <MoreHorizontal class="size-4" aria-hidden="true" />
    </button>
</template>

<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next';

import type { PanelAnchor } from '@/lib/anchor';
import { cn } from '@/lib/utils';

/**
 * The desktop way into a list row's {@link ActionSheet}: a `⋯` at the row's
 * trailing edge that appears on hover or keyboard focus. Phones keep the long
 * press ({@link longPressDirective}), which is why this is `lg:` and up only.
 *
 * Belongs in a row that is `group` and *beside* the row's own button — a menu
 * trigger nested in the button that opens the song would be invalid markup.
 */
interface Props {
    /** Names the row it acts on, since the glyph alone says nothing. */
    label: string;
    /** Whether this row's menu is the one currently open. */
    active?: boolean;
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    active: false,
    class: undefined,
});

const emit = defineEmits<{
    /** The button itself, which the popover then hangs off. */
    open: [anchor: PanelAnchor];
}>();
</script>
