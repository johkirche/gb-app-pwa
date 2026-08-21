import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { type ServicePlan, type ServicePlanOrigin, db } from '@/db';
import {
    DEFAULT_SERVICE_TITLE,
    type ServicePlanDraft,
    createPlan,
    endOfDay,
    formatServiceDate,
    getServicePlanProvider,
    isPlanExpired,
    toPlainPlan,
    todayIsoDate,
} from '@/services/servicePlans';

/**
 * Which stored plan is the one in use. The `services` table is keyed by id
 * rather than pinned to a single row so plans fetched from a provider can later
 * be cached alongside the active one; this key says which of them the
 * Gottesdienst tab shows.
 */
const ACTIVE_PLAN_KEY = 'service.activeId';

/**
 * The Gottesdienst selection: the two or three songs of one service, one tap
 * away and gone by themselves afterwards.
 *
 * It is deliberately not a playlist — playlists are permanent and personal —
 * and deliberately not tied to how the songs were chosen: marking them here by
 * hand and adopting a plan from a provider (a playlist today, a Directus-published
 * order of service later) end in the same record.
 */
export const useServiceStore = defineStore('service', () => {
    const plan = ref<ServicePlan | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const entries = computed(() => plan.value?.entries ?? []);
    const songIds = computed(() => entries.value.map((entry) => entry.songId));
    const songIdSet = computed(() => new Set(songIds.value));
    const entryCount = computed(() => entries.value.length);
    /** What the tab bar asks: is there anything to show? */
    const hasSelection = computed(() => entryCount.value > 0);
    /** The selection in one line („3 Lieder · Heute") — for rows that link to it. */
    const selectionLabel = computed(() => {
        const songs = entryCount.value === 1 ? '1 Lied' : `${entryCount.value} Lieder`;
        const date = plan.value ? formatServiceDate(plan.value.date) : '';
        return [songs, date].filter(Boolean).join(' · ');
    });

    function isInPlan(songId: string): boolean {
        return songIdSet.value.has(songId);
    }

    async function write(next: ServicePlan): Promise<ServicePlan> {
        const record = toPlainPlan(next);
        await db.transaction('rw', db.services, db.meta, async () => {
            await db.services.put(record);
            await db.meta.put({ key: ACTIVE_PLAN_KEY, value: record.id });
        });
        plan.value = record;
        return record;
    }

    /** Persist a change to the current plan, stamping it as touched. */
    async function update(changes: Partial<ServicePlan>): Promise<ServicePlan | null> {
        if (!plan.value) return null;
        try {
            error.value = null;
            return await write({ ...toPlainPlan(plan.value), ...changes, updatedAt: new Date() });
        } catch (err) {
            console.error('Error saving service plan:', err);
            error.value = 'Failed to save the service selection';
            throw err;
        }
    }

    async function forget(): Promise<void> {
        const id = plan.value?.id;
        plan.value = null;
        await db.transaction('rw', db.services, db.meta, async () => {
            if (id) await db.services.delete(id);
            await db.meta.delete(ACTIVE_PLAN_KEY);
        });
    }

    /** Drop the plan once its day is over. Returns true when it was dropped. */
    async function pruneIfExpired(): Promise<boolean> {
        if (!plan.value || !isPlanExpired(plan.value)) return false;
        await forget();
        return true;
    }

    async function load(): Promise<ServicePlan | null> {
        try {
            error.value = null;
            isLoading.value = true;

            const active = await db.meta.get(ACTIVE_PLAN_KEY);
            const stored = active?.value ? await db.services.get(active.value) : undefined;
            plan.value = stored ?? null;

            // Yesterday's plans are cleared out on the way in, so the tab never
            // comes back with last Sunday's songs still on it.
            await pruneIfExpired();
            await db.services.where('expiresAt').below(Date.now()).delete();

            return plan.value;
        } catch (err) {
            console.error('Error loading the service plan:', err);
            error.value = 'Failed to load the service selection';
            return null;
        } finally {
            isLoading.value = false;
        }
    }

    /** The current plan, creating an empty one for today if there is none. */
    async function ensurePlan(): Promise<ServicePlan> {
        if (plan.value) return plan.value;
        return await write(
            createPlan({ title: DEFAULT_SERVICE_TITLE, date: todayIsoDate(), entries: [] }),
        );
    }

    async function addSong(songId: string): Promise<void> {
        const current = await ensurePlan();
        if (current.entries.some((entry) => entry.songId === songId)) return;
        await update({ entries: [...current.entries, { songId }] });
    }

    async function removeSong(songId: string): Promise<void> {
        if (!plan.value) return;
        await update({ entries: plan.value.entries.filter((entry) => entry.songId !== songId) });
    }

    /** Returns whether the song is on the plan afterwards. */
    async function toggleSong(songId: string): Promise<boolean> {
        if (isInPlan(songId)) {
            await removeSong(songId);
            return false;
        }
        await addSong(songId);
        return true;
    }

    /**
     * Reorder to `orderedIds`. Entries whose id is missing from the list are
     * appended, so a caller that reorders only the songs it renders cannot drop
     * the ones it filtered out.
     */
    async function reorder(orderedIds: string[]): Promise<void> {
        if (!plan.value) return;
        const byId = new Map(plan.value.entries.map((entry) => [entry.songId, entry]));
        const ordered = orderedIds
            .map((id) => byId.get(id))
            .filter((entry): entry is NonNullable<typeof entry> => !!entry);
        const orderedSet = new Set(ordered.map((entry) => entry.songId));
        const rest = plan.value.entries.filter((entry) => !orderedSet.has(entry.songId));
        await update({ entries: [...ordered, ...rest] });
    }

    async function setDate(isoDate: string): Promise<void> {
        if (!plan.value) return;
        // The expiry is not a second setting to keep in sync — it *is* the date.
        await update({ date: isoDate, expiresAt: endOfDay(isoDate) });
    }

    async function setTitle(title: string): Promise<void> {
        if (!plan.value) return;
        await update({ title: title.trim() || DEFAULT_SERVICE_TITLE });
    }

    /** Replace whatever is on the plan with `draft`. */
    async function replaceWith(
        draft: ServicePlanDraft,
        origin: ServicePlanOrigin | null = null,
    ): Promise<ServicePlan> {
        const previousId = plan.value?.id;
        const next = createPlan(draft, { origin });
        await write(next);
        if (previousId && previousId !== next.id) {
            await db.services.delete(previousId);
        }
        return next;
    }

    /**
     * Take over a plan a provider has on offer. An unknown provider or a
     * vanished offer resolves to null rather than throwing — an offer list can
     * always be a moment out of date.
     */
    async function adoptOffer(providerId: string, offerId: string): Promise<ServicePlan | null> {
        const provider = getServicePlanProvider(providerId);
        if (!provider) {
            console.warn(`No service plan provider registered for "${providerId}"`);
            return null;
        }

        try {
            error.value = null;
            const draft = await provider.loadOffer(offerId);
            if (!draft || draft.entries.length === 0) return null;

            return await replaceWith(draft, {
                providerId,
                offerId,
                label: draft.title,
                fetchedAt: new Date(),
            });
        } catch (err) {
            console.error(`Error adopting offer "${offerId}" from "${providerId}":`, err);
            error.value = 'Failed to load the service plan';
            return null;
        }
    }

    /** Clear the selection (the tab disappears with it). */
    async function clear(): Promise<void> {
        await forget();
    }

    // Wipe both memory and Dexie — used on logout, where the plan is user data
    // that must not carry over to the next account on a shared device.
    async function clearAll(): Promise<void> {
        plan.value = null;
        await db.services.clear();
        await db.meta.delete(ACTIVE_PLAN_KEY);
    }

    // A phone that sat on the lectern overnight never reloads the app, so the
    // expiry has to be re-checked when it comes back to the foreground.
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') void pruneIfExpired();
        });
    }

    const initPromise = load();

    return {
        // State
        plan,
        isLoading,
        error,
        // Getters
        entries,
        songIds,
        entryCount,
        hasSelection,
        selectionLabel,
        isInPlan,
        // Actions
        load,
        ensurePlan,
        addSong,
        removeSong,
        toggleSong,
        reorder,
        setDate,
        setTitle,
        replaceWith,
        adoptOffer,
        pruneIfExpired,
        clear,
        clearAll,
        // Initialization promise
        initPromise,
    };
});
