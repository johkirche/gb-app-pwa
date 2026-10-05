import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';

import { type Leseplan, db } from '@/db';
import { registerUserStateReset } from '@/services/userStateReset';
import type { ChapterRef } from '@/utils/bibel';
import {
    type PlanStatus,
    dayNumber,
    daysCompletedBy,
    findLeseplan,
    localDateString,
    planStatus,
} from '@/utils/leseplaene';

/**
 * The reading plan the reader is following, if any. One at a time: the table
 * holds at most one row, and starting a plan replaces it.
 */
export const useLeseplanStore = defineStore('leseplan', () => {
    const fortschritt = useBibelFortschrittStore();

    const active = ref<Leseplan | null>(null);
    const definition = computed(() => (active.value ? findLeseplan(active.value.id) : undefined));

    // Set by any change, so a load still in flight does not overwrite a plan
    // started or stopped in the meantime with what the table held before.
    let changed = false;

    async function load() {
        changed = false;
        try {
            // Should there ever be more than one row, the newest plan wins; a
            // plan this build does not know is ignored.
            const rows = (await db.leseplaene.toArray())
                .filter((row) => findLeseplan(row.id))
                .sort((a, b) => b.startedOn.localeCompare(a.startedOn));
            if (!changed) active.value = rows[0] ?? null;
        } catch (err) {
            console.error('Error loading the reading plan:', err);
        }
    }

    // Dexie stores a structured clone, which a reactive proxy is not.
    async function save(plan: Leseplan) {
        changed = true;
        const row: Leseplan = { ...plan, doneDays: [...plan.doneDays] };
        await db.leseplaene.put(row);
        active.value = row;
    }

    /** Begin a plan today, ending whichever one ran before. */
    async function start(id: string, today: Date = new Date()) {
        if (!findLeseplan(id)) return;
        await db.leseplaene.clear();
        await save({ id, startedOn: localDateString(today), doneDays: [] });
    }

    async function stop() {
        changed = true;
        await db.leseplaene.clear();
        active.value = null;
    }

    async function setDayDone(day: number, done: boolean) {
        const plan = active.value;
        if (!plan) return;
        const days = new Set(plan.doneDays);
        if (done) days.add(day);
        else days.delete(day);
        await save({ ...plan, doneDays: [...days].sort((a, b) => a - b) });
    }

    function isDayDone(day: number): boolean {
        return active.value?.doneDays.includes(day) ?? false;
    }

    function status(today: Date): PlanStatus | null {
        const plan = active.value;
        if (!plan || !definition.value) return null;
        return planStatus(definition.value, plan.startedOn, plan.doneDays, today);
    }

    /** The chapters of one plan day; empty outside the plan. */
    function chaptersOf(day: number): ChapterRef[] {
        return definition.value?.days[day - 1] ?? [];
    }

    /**
     * Read for this plan: marked read on or after the day it began. A chapter
     * read in an earlier round does not fill today's portion by itself.
     */
    function isReadForPlan(ref: ChapterRef): boolean {
        const plan = active.value;
        const at = fortschritt.readAt(ref.slug, ref.chapter);
        return !!plan && !!at && localDateString(new Date(at)) >= plan.startedOn;
    }

    // Marking the last open chapter of a day, in the reader or on the card,
    // ticks that day off.
    fortschritt.onMarkedRead((ref) => {
        const plan = active.value;
        if (!plan || !definition.value) return;
        const days = daysCompletedBy(
            definition.value,
            ref,
            plan.doneDays,
            dayNumber(plan.startedOn, new Date()),
            isReadForPlan,
        );
        if (days.length === 0) return;
        save({
            ...plan,
            doneDays: [...new Set([...plan.doneDays, ...days])].sort((a, b) => a - b),
        }).catch((err) => console.error('Error ticking off a plan day:', err));
    });

    registerUserStateReset(() => {
        changed = true;
        active.value = null;
    });
    load();

    return {
        active,
        definition,
        start,
        stop,
        setDayDone,
        isDayDone,
        status,
        chaptersOf,
        isReadForPlan,
        load,
    };
});
