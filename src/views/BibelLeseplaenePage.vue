<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Lesepläne">
            <template #leading>
                <BackButton default-href="/tabs/bibel" />
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col pb-24 pt-4">
                <p class="px-2 text-[0.9375rem] text-muted-foreground">
                    Ein Leseplan teilt die Bibel in Abschnitte für jeden Tag. Was Sie gelesen haben,
                    markieren Sie am Ende des Kapitels; der Tag wird dann abgehakt.
                </p>

                <!-- Side by side on a desktop: the plans are read as a choice, not a list. -->
                <ul class="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                    <li
                        v-for="plan in LESEPLAENE"
                        :key="plan.id"
                        class="flex flex-col rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
                        :class="{ 'border-gold/50': isActive(plan.id) }"
                    >
                        <p v-if="isActive(plan.id)" class="label-micro mb-1 text-gold">Ihr Plan</p>
                        <h2 class="font-display text-xl font-semibold leading-tight">
                            {{ plan.name }}
                        </h2>
                        <p class="mt-1 text-sm text-muted-foreground">{{ plan.description }}</p>
                        <p class="mt-1 text-sm text-muted-foreground">
                            {{ plan.days.length }} Tage · {{ chapterCount(plan) }} Kapitel
                        </p>

                        <template v-if="isActive(plan.id) && status">
                            <Progress
                                :model-value="status.done / status.length"
                                class="mt-4 h-1.5"
                            />
                            <p class="mt-2 text-sm">
                                <template v-if="status.complete">Ganz gelesen</template>
                                <template v-else>
                                    Tag {{ status.day }} von {{ status.length }} ·
                                    {{ status.done }}
                                    {{ status.done === 1 ? 'Tag' : 'Tage' }} erledigt
                                </template>
                            </p>
                            <div class="mt-auto flex gap-2 pt-4">
                                <Button variant="outline" size="sm" @click="stop">Beenden</Button>
                            </div>
                        </template>

                        <div v-else class="mt-auto flex gap-2 pt-4">
                            <Button size="sm" @click="start(plan)">Beginnen</Button>
                        </div>
                    </li>
                </ul>

                <!-- The whole Bible, whichever plan the chapters were read in. -->
                <section class="mt-8 px-2" aria-labelledby="fortschritt-heading">
                    <h2 id="fortschritt-heading" class="font-display text-xl font-semibold">
                        Ihr Fortschritt
                    </h2>
                    <Progress
                        :model-value="fortschritt.overall.read / fortschritt.overall.total"
                        class="mt-3 h-1.5"
                    />
                    <p class="mt-2 text-sm text-muted-foreground">
                        {{ fortschritt.overall.read }} von {{ fortschritt.overall.total }} Kapiteln
                        der Bibel gelesen ({{ fortschritt.overall.percent }} %)
                    </p>
                </section>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';
import { useLeseplanStore } from '@/stores/leseplan';

import { useConfirm } from '@/composables/useConfirm';
import { useCurrentDate } from '@/composables/useCurrentDate';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { LESEPLAENE, type LeseplanDefinition, chapterCount } from '@/utils/leseplaene';

const store = useLeseplanStore();
const fortschritt = useBibelFortschrittStore();
const { confirm } = useConfirm();
const now = useCurrentDate();

const status = computed(() => store.status(now.value));

function isActive(id: string): boolean {
    return store.active?.id === id;
}

async function start(plan: LeseplanDefinition) {
    // One plan at a time: switching ends the one being read, so ask first.
    const current = store.definition;
    if (
        current &&
        !(await confirm({
            title: 'Leseplan wechseln?',
            message: `„${current.name}“ wird beendet. Gelesene Kapitel bleiben markiert.`,
            confirmText: 'Wechseln',
        }))
    ) {
        return;
    }
    try {
        await store.start(plan.id);
    } catch (err) {
        console.error('Error starting the reading plan:', err);
    }
}

async function stop() {
    const confirmed = await confirm({
        title: 'Leseplan beenden?',
        message: 'Gelesene Kapitel bleiben markiert.',
        confirmText: 'Beenden',
        destructive: true,
    });
    if (!confirmed) return;
    try {
        await store.stop();
    } catch (err) {
        console.error('Error stopping the reading plan:', err);
    }
}
</script>
