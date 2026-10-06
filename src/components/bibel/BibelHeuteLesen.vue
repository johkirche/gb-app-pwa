<template>
    <!-- Today's portion of the reading plan. Without a plan, a quiet way in to
         choosing one. -->
    <section
        v-if="store.definition && status"
        class="mt-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
        aria-labelledby="heute-lesen-heading"
    >
        <div class="flex items-baseline justify-between gap-3">
            <h2 id="heute-lesen-heading" class="label-micro text-gold">Heute lesen</h2>
            <RouterLink
                to="/tabs/bibel/plaene"
                class="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
                Lesepläne
            </RouterLink>
        </div>
        <p class="mt-1 font-display text-xl font-semibold leading-tight">
            {{ store.definition.name }}
        </p>
        <p class="mt-0.5 text-sm text-muted-foreground">
            Tag {{ status.day }} von {{ status.length }}
            <template v-if="todayDone && !status.complete">· erledigt</template>
        </p>

        <p v-if="status.complete" class="mt-3 text-[0.9375rem]">
            Geschafft: Sie haben den ganzen Plan gelesen.
            <RouterLink
                to="/tabs/bibel/plaene"
                class="text-gold underline-offset-4 hover:underline"
            >
                Einen neuen wählen
            </RouterLink>
        </p>

        <template v-else>
            <ul class="mt-3 divide-y divide-border">
                <li v-for="entry in today" :key="`${entry.slug}/${entry.chapter}`" class="flex">
                    <button
                        type="button"
                        class="flex size-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted"
                        :aria-pressed="store.isReadForPlan(entry)"
                        :aria-label="`${chapterLabel(entry)} gelesen`"
                        @click="toggleRead(entry)"
                    >
                        <CircleCheck
                            v-if="store.isReadForPlan(entry)"
                            class="size-5 text-gold"
                            aria-hidden="true"
                        />
                        <Circle v-else class="size-5 text-muted-foreground" aria-hidden="true" />
                    </button>
                    <RouterLink
                        :to="chapterPath(entry)"
                        class="flex min-w-0 flex-1 items-center gap-2 rounded-md pl-1 pr-2 text-[0.9375rem] font-medium transition-colors hover:bg-muted"
                    >
                        <span class="flex-1 truncate">{{ chapterLabel(entry) }}</span>
                        <ChevronRight
                            class="size-[1.125rem] shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </RouterLink>
                </li>
            </ul>

            <!-- Earlier days still open: named, with the way back to the first. -->
            <p v-if="catchUp" class="mt-3 text-sm text-muted-foreground">
                {{ catchUp.text }}
                <RouterLink
                    :to="chapterPath(catchUp.next)"
                    class="whitespace-nowrap text-gold underline-offset-4 hover:underline"
                >
                    Nachholen
                </RouterLink>
            </p>
        </template>
    </section>

    <RouterLink
        v-else
        to="/tabs/bibel/plaene"
        class="mt-2 flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-muted active:bg-muted"
    >
        <CalendarDays class="size-[1.125rem] shrink-0 text-gold" aria-hidden="true" />
        <span class="min-w-0 flex-1">
            <span class="block text-[0.9375rem] font-medium leading-tight">Lesepläne</span>
            <span class="mt-0.5 block text-sm text-muted-foreground">
                Die Bibel in einem Jahr, die Psalmen in einem Monat …
            </span>
        </span>
        <ChevronRight class="size-[1.125rem] shrink-0 text-muted-foreground" aria-hidden="true" />
    </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { CalendarDays, ChevronRight, Circle, CircleCheck } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';
import { useLeseplanStore } from '@/stores/leseplan';

import { useCurrentDate } from '@/composables/useCurrentDate';

import { type ChapterRef, chapterLabel, chapterPath } from '@/utils/bibel';
import { catchUpText } from '@/utils/leseplaene';

const store = useLeseplanStore();
const fortschritt = useBibelFortschrittStore();
const now = useCurrentDate();

const status = computed(() => store.status(now.value));
const today = computed(() => (status.value ? store.chaptersOf(status.value.day) : []));
const todayDone = computed(() => !!status.value && store.isDayDone(status.value.day));

const catchUp = computed(() => {
    const behind = status.value?.behind ?? [];
    if (behind.length === 0) return null;
    // The first chapter of the earliest open day not yet read in this plan.
    const first = store.chaptersOf(behind[0]);
    const next = first.find((ref) => !store.isReadForPlan(ref)) ?? first[0];
    return next ? { text: catchUpText(behind), next } : null;
});

// The tick reads "read in this plan": a chapter read in an earlier round shows
// open, and ticking it marks it again, today.
function toggleRead(ref: ChapterRef) {
    const action = store.isReadForPlan(ref)
        ? fortschritt.unmarkRead(ref.slug, ref.chapter)
        : fortschritt.markRead(ref.slug, ref.chapter);
    action.catch((err) => console.error('Error marking the chapter read:', err));
}
</script>
