<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <p class="label-micro text-center text-flourish">Kurz erklärt</p>

        <Transition name="tour" mode="out-in">
            <div :key="slide.kind" class="mt-4">
                <!-- The one slide that asks something: question first, then
                     what can be answered. The others show, then say. -->
                <TourIllustration v-if="slide.kind !== 'bibel'" :kind="slide.kind" />
                <h1
                    class="text-center font-display text-3xl font-semibold"
                    :class="slide.kind === 'bibel' ? 'mt-2' : 'mt-8'"
                >
                    {{ slide.title }}
                </h1>
                <!-- Five lines' room whatever the slide says, so the buttons
                     under it stay put from one slide to the next. -->
                <p
                    class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground"
                    :class="slide.kind === 'bibel' ? undefined : 'min-h-[5lh]'"
                >
                    {{ slide.text }}
                </p>
                <TourBibelChoice v-if="slide.kind === 'bibel'" class="mt-6" />
            </div>
        </Transition>

        <div class="mt-auto flex flex-col gap-2 pt-8">
            <Button type="button" size="lg" class="w-full" @click="$emit('next')">
                Weiter
                <ArrowRight aria-hidden="true" />
            </Button>
            <Button
                v-if="!isLast"
                type="button"
                variant="ghost"
                size="lg"
                class="w-full text-muted-foreground"
                @click="$emit('skip')"
            >
                Überspringen
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';

import TourBibelChoice from '@/components/onboarding/TourBibelChoice.vue';
import TourIllustration from '@/components/onboarding/TourIllustration.vue';
import type { TourSlide } from '@/components/onboarding/tour';
import { Button } from '@/components/ui/button';

defineProps<{
    slide: TourSlide;
    /** The last slide has nothing left to skip to but the next step. */
    isLast: boolean;
}>();

defineEmits<{
    next: [];
    /** Past the rest of the tour, to the step after it. */
    skip: [];
}>();
</script>

<style scoped>
.tour-enter-active,
.tour-leave-active {
    transition:
        opacity 180ms ease,
        transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.tour-enter-from {
    opacity: 0;
    transform: translateX(1.5rem);
}

.tour-leave-to {
    opacity: 0;
    transform: translateX(-1.5rem);
}

@media (prefers-reduced-motion: reduce) {
    .tour-enter-active,
    .tour-leave-active {
        transition: opacity 120ms ease;
    }

    .tour-enter-from,
    .tour-leave-to {
        transform: none;
    }
}
</style>
