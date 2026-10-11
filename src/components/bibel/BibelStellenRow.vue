<template>
    <!-- Picking: the whole row is the checkbox's target, so a thumb need not
         find the box. Otherwise the row opens the chapter at its verse. -->
    <label
        v-if="selecting"
        class="flex cursor-pointer items-start gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-muted"
    >
        <Checkbox
            :model-value="selected"
            class="mt-0.5 size-[1.125rem]"
            :aria-label="`${stelleLabel(stelle)} auswählen`"
            @update:model-value="emit('toggle')"
        />
        <BibelStelle :stelle="stelle" />
    </label>
    <RouterLink
        v-else
        :to="chapterPath(stelle, stelle.verses[0])"
        class="flex items-start gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-muted"
    >
        <BibelStelle :stelle="stelle" />
    </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

import BibelStelle from '@/components/bibel/BibelStelle.vue';
import { Checkbox } from '@/components/ui/checkbox';

import { chapterPath } from '@/utils/bibel';
import { type Stelle, stelleLabel } from '@/utils/meineStellen';

defineProps<{
    stelle: Stelle;
    selecting?: boolean;
    selected?: boolean;
}>();

const emit = defineEmits<{ (e: 'toggle'): void }>();
</script>
