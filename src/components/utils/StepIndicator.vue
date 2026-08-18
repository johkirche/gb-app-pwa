<template>
    <div class="mb-8 flex items-center justify-between">
        <Button
            v-if="currentStep > 1"
            variant="ghost"
            size="icon"
            aria-label="Zurück"
            @click="$emit('back')"
        >
            <ArrowLeft class="!size-5" aria-hidden="true" />
        </Button>
        <div v-else class="w-10" aria-hidden="true"></div>
        <div class="flex items-center justify-center gap-2">
            <span
                v-for="step in totalSteps"
                :key="step"
                class="h-2 rounded-full transition-all duration-300"
                :class="
                    currentStep === step
                        ? 'w-6 bg-primary'
                        : currentStep > step
                          ? 'w-2 bg-gold'
                          : 'w-2 bg-border'
                "
            ></span>
        </div>
        <div class="w-10" aria-hidden="true"></div>
    </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';

interface Props {
    currentStep: number;
    totalSteps: number;
}

defineProps<Props>();
defineEmits<{
    back: [];
}>();
</script>
