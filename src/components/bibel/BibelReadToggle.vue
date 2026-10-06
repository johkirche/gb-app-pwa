<template>
    <!-- At the foot of the chapter, where the reader arrives having read it. -->
    <div class="mx-auto mt-10 flex max-w-[36rem] justify-center">
        <Button
            variant="outline"
            :class="
                read ? 'min-w-[14rem] border-gold/60 text-gold hover:text-gold' : 'min-w-[14rem]'
            "
            :aria-pressed="read"
            @click="toggle"
        >
            <CircleCheck v-if="read" aria-hidden="true" />
            <Circle v-else aria-hidden="true" />
            {{ read ? 'Gelesen' : 'Als gelesen markieren' }}
        </Button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Circle, CircleCheck } from 'lucide-vue-next';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';
import { useLeseplanStore } from '@/stores/leseplan';

import { Button } from '@/components/ui/button';

const props = defineProps<{ slug: string; chapter: number }>();

const fortschritt = useBibelFortschrittStore();
// Created here so it is listening when this chapter completes a plan day,
// even if the Bibel tab has not been opened since the app started.
useLeseplanStore();

const read = computed(() => fortschritt.isRead(props.slug, props.chapter));

function toggle() {
    fortschritt
        .toggle(props.slug, props.chapter)
        .catch((err) => console.error('Error marking the chapter read:', err));
}
</script>
