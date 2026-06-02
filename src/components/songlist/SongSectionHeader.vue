<template>
    <div :id="sectionId" class="section-header">
        <span class="section-header__rule section-header__rule--lead" aria-hidden="true"></span>
        <span class="section-header__label">{{ label }}</span>
        <span class="section-header__rule section-header__rule--trail" aria-hidden="true"></span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    sectionKey: string;
    label: string;
}>();

const sectionId = computed(() => `section-${props.sectionKey}`);
</script>

<style scoped>
/* Editorial section divider — mirrors the home screen's date label + hairline
   rule rather than a heavy filled band. The label aligns with the song number
   boxes below (rows start at padding-start = --spacing-xs). */
.section-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-md) var(--spacing-sm) var(--spacing-xs);
    /* Opaque page background so rows scroll cleanly underneath while sticky */
    background: var(--ion-background-color);
    position: sticky;
    /* Sit just below the sticky toolbar (~56px) */
    top: 64px;
    z-index: 100;
}

.section-header__label {
    flex: 0 0 auto;
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    /* Ties the header to the primary-coloured number boxes */
    color: var(--ion-color-primary);
}

.section-header__rule {
    height: 1px;
    background: var(--ion-color-light-shade);
}

/* Short hairline leading into the label */
.section-header__rule--lead {
    flex: 0 0 1.5rem;
}

/* Long hairline filling the rest of the row */
.section-header__rule--trail {
    flex: 1 1 auto;
}
</style>
