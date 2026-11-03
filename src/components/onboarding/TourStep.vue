<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <p class="label-micro text-center text-flourish">
            Kurz erklärt · {{ index + 1 }} von {{ TOUR.length }}
        </p>

        <Transition name="tour" mode="out-in">
            <div :key="slide.kind" class="mt-4">
                <TourIllustration :kind="slide.kind" />
                <h1 class="mt-8 text-center font-display text-3xl font-semibold">
                    {{ slide.title }}
                </h1>
                <!-- Four lines' room whatever the slide says, so the dots and
                     buttons under it stay put from one slide to the next. -->
                <p
                    class="mt-3 min-h-[4lh] text-center text-[0.9375rem] leading-relaxed text-muted-foreground"
                >
                    {{ slide.text }}
                </p>
            </div>
        </Transition>

        <!-- The slides as dots, and a way straight to any of them. -->
        <div class="mt-6 flex justify-center gap-2">
            <button
                v-for="(item, i) in TOUR"
                :key="item.kind"
                type="button"
                class="h-2 rounded-full transition-all"
                :class="i === index ? 'w-6 bg-primary' : 'w-2 bg-foreground/20'"
                :aria-label="`${i + 1} von ${TOUR.length}: ${item.title}`"
                :aria-current="i === index ? 'step' : undefined"
                @click="index = i"
            />
        </div>

        <DownloadStatus
            class="mt-8"
            v-bind="download"
            @download="$emit('download')"
            @retry="$emit('retry')"
        />

        <div class="mt-auto flex flex-col gap-2 pt-8">
            <template v-if="!isLast">
                <Button type="button" size="lg" class="w-full" @click="index++">
                    Weiter
                    <ArrowRight aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    class="w-full text-muted-foreground"
                    @click="index = TOUR.length - 1"
                >
                    Überspringen
                </Button>
            </template>
            <!-- Held while the book is still coming down, as „Fertig" always
                 was: a Liederliste with half its engravings is no place to be
                 sent. -->
            <Button
                v-else
                type="button"
                size="lg"
                class="w-full"
                :disabled="download.isSyncing"
                @click="$emit('finish')"
            >
                Fertig
                <Check aria-hidden="true" />
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { ArrowRight, Check } from 'lucide-vue-next';

import DownloadStatus from '@/components/onboarding/DownloadStatus.vue';
import TourIllustration from '@/components/onboarding/TourIllustration.vue';
import type { DownloadState } from '@/components/onboarding/downloadState';
import { TOUR } from '@/components/onboarding/tour';
import { Button } from '@/components/ui/button';

defineProps<{ download: DownloadState }>();

defineEmits<{
    download: [];
    retry: [];
    finish: [];
}>();

const index = ref(0);
const slide = computed(() => TOUR[index.value]);
const isLast = computed(() => index.value === TOUR.length - 1);
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
