<template>
    <!-- Editorial section divider: gold micro-label + trailing hairline. Sticks to the
         top of the scroll container (the toolbar lives outside it after the migration).
         The class `section-header` is a load-bearing contract: SongsListPage measures the
         first one to clear the sticky row when it scrolls a section into view.

         A heading, not a div. These are the only complete list of the list's sections,
         and the heading rotor is how a screen reader walks a long page — the A–Z rail is
         a shortcut beside it, not a substitute, and it draws only as many labels as fit.

         In Nummer mode the divider would be noise, because every row already shows its
         own number; `visuallyHidden` keeps the heading and drops the ink. -->
    <h2
        :id="sectionId"
        class="flex items-center gap-3"
        :class="
            visuallyHidden
                ? 'sr-only'
                : 'section-header sticky top-0 z-10 bg-background px-2 pb-2 pt-4'
        "
        :aria-label="spokenLabel"
    >
        <span class="label-micro min-w-0 truncate text-gold">{{ label }}</span>
        <span class="h-px min-w-6 flex-1 bg-border" aria-hidden="true"></span>
    </h2>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    sectionKey: string;
    /** The glyph on the divider: "A", "300", "Advent". */
    label: string;
    /** The heading's spoken name — see SongSection.spokenLabel. */
    spokenLabel: string;
    /** Keep the heading in the document, take the divider off the page. */
    visuallyHidden?: boolean;
}>();

const sectionId = computed(() => `section-${props.sectionKey}`);
</script>
