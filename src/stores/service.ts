import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import {
    type BibelPassage,
    type ServiceEntry,
    type ServicePlan,
    type ServicePlanOrigin,
    type UserList,
    type UserListEntry,
    db,
} from '@/db';
import { META_KEYS } from '@/db/metaKeys';
import {
    DEFAULT_SERVICE_TITLE,
    type ServiceItem,
    type ServicePlanDraft,
    type VerseSelection,
    createPlan,
    endOfDay,
    formatSelectionCount,
    formatServiceDate,
    getServicePlanProvider,
    isPlanExpired,
    lesungItemKey,
    normalizeVerseSelection,
    reorderPlanContents,
    serviceItems,
    songItemKey,
    toPlainPlan,
    todayIsoDate,
} from '@/services/servicePlans';
import { entryId } from '@/services/userData/ids';
import { assignPositions } from '@/services/userData/positions';
import {
    type Fresh,
    deleteEntries,
    deleteLists,
    entriesOf,
    fresh,
    getList,
    listsOfKind,
    newEntry,
    newList,
    onUserDataApplied,
    putEntries,
    putLists,
} from '@/services/userData/repo';
import { passageKey, toPassage, withPassage, withoutPassage } from '@/utils/bibelPassage';
import { passageToRef, refItemKey, refToPassage, songItemKeyOf } from '@/utils/textRef';

/** An Ablauf's day is over: past its date, and nobody kept it. */
function isPast(list: UserList, now = Date.now()): boolean {
    return !list.keep && now > endOfDay(list.date ?? todayIsoDate());
}

function passageOf(entry: UserListEntry): BibelPassage | null {
    if (entry.kind !== 'passage' || !entry.work || !entry.ref) return null;
    return toPassage(refToPassage({ work: entry.work, ref: entry.ref, refEnd: entry.refEnd }));
}

/** The plan a list of kind `service` and its entries make. */
function planOf(list: UserList, entries: UserListEntry[]): ServicePlan {
    const date = list.date ?? todayIsoDate();
    const songs: ServiceEntry[] = [];
    const lesungen: BibelPassage[] = [];
    const order: string[] = [];
    for (const entry of entries) {
        if (entry.kind === 'song' && entry.songId) {
            songs.push({
                songId: entry.songId,
                verses: entry.verses ? [...entry.verses] : null,
                ...(entry.note ? { note: entry.note } : {}),
            });
            order.push(songItemKey(entry.songId));
            continue;
        }
        const passage = passageOf(entry);
        if (passage) {
            lesungen.push(passage);
            order.push(lesungItemKey(passageKey(passage)));
        }
    }
    const touched = [list.updatedAt, ...entries.map((e) => e.updatedAt)].sort().at(-1)!;
    return {
        id: list.id,
        title: list.name || DEFAULT_SERVICE_TITLE,
        date,
        entries: songs,
        expiresAt: endOfDay(date),
        origin: list.origin ?? null,
        ...(lesungen.length ? { lesungen } : {}),
        order,
        createdAt: new Date(list.createdAt),
        updatedAt: new Date(touched),
    };
}

/**
 * Which stored plan is the one in use. The `services` table is keyed by id
 * rather than pinned to a single row so plans fetched from a provider can later
 * be cached alongside the active one; this key says which of them the
 * Gottesdienst tab shows.
 */
const ACTIVE_PLAN_KEY = META_KEYS.activeService;

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
    /** The readings, in the order they are read. Older plans have none. */
    const lesungen = computed<BibelPassage[]>(() => plan.value?.lesungen ?? []);
    /** Songs and readings together, in the order the service holds them. */
    const items = computed<ServiceItem[]>(() => (plan.value ? serviceItems(plan.value) : []));
    /** What the tab bar asks: is there anything to show? A reading counts too. */
    const hasSelection = computed(() => entryCount.value > 0 || lesungen.value.length > 0);
    /** The selection in one line („3 Lieder · Heute") — for rows that link to it. */
    const selectionLabel = computed(() => {
        const songs = formatSelectionCount(entryCount.value, lesungen.value.length);
        const date = plan.value ? formatServiceDate(plan.value.date) : '';
        return [songs, date].filter(Boolean).join(' · ');
    });

    function isInPlan(songId: string): boolean {
        return songIdSet.value.has(songId);
    }

    /**
     * Which verses of that song are sung — null for the whole hymn, and for a
     * song that is not on the plan at all.
     */
    function versesFor(songId: string): VerseSelection {
        return entries.value.find((entry) => entry.songId === songId)?.verses ?? null;
    }

    /**
     * Store a plan as its list and entries. Only what changed is written: an
     * entry that kept its song, verses, note and place is left alone, so a
     * second device editing the same Ablauf only meets this one where both
     * touched the same entry.
     */
    async function write(next: ServicePlan): Promise<ServicePlan> {
        const record = toPlainPlan(next);
        const list = await getList(record.id);
        const current = list ? await entriesOf(record.id) : [];

        const songEntry = new Map(
            current.filter((e) => e.kind === 'song' && e.songId).map((e) => [e.songId!, e]),
        );
        const passageEntry = new Map(
            current.flatMap((e) => {
                const p = passageOf(e);
                return p ? [[passageKey(p), e] as const] : [];
            }),
        );

        const wanted: Fresh<UserListEntry>[] = serviceItems(record).map((item) => {
            if (item.kind === 'song') {
                const { songId, verses, note } = item.entry;
                const existing = songEntry.get(songId);
                return {
                    ...(existing
                        ? fresh(existing)
                        : newEntry({
                              id: entryId(record.id, songItemKeyOf(songId)),
                              listId: record.id,
                              kind: 'song',
                              position: '',
                              songId,
                          })),
                    verses: verses ? [...verses] : null,
                    note: note ?? null,
                };
            }
            const ref = passageToRef(item.passage);
            const existing = passageEntry.get(passageKey(item.passage));
            return existing
                ? fresh(existing)
                : newEntry({
                      id: entryId(record.id, refItemKey(ref)),
                      listId: record.id,
                      kind: 'passage',
                      position: '',
                      ...ref,
                  });
        });

        const positions = assignPositions(
            wanted.map((e) => e.id),
            new Map(current.map((e) => [e.id, e.position])),
        );
        const before = new Map(current.map((e) => [e.id, e]));
        const writes = wanted
            .map((e) => ({ ...e, position: positions.get(e.id)! }))
            .filter((e) => {
                const was = before.get(e.id);
                return (
                    !was ||
                    was.position !== e.position ||
                    JSON.stringify(was.verses ?? null) !== JSON.stringify(e.verses ?? null) ||
                    (was.note ?? null) !== (e.note ?? null)
                );
            });
        const keep = new Set(wanted.map((e) => e.id));

        const listRow = newList({
            ...(list ? fresh(list) : {}),
            id: record.id,
            kind: 'service',
            name: record.title,
            date: record.date,
            origin: record.origin ?? null,
            createdAt: list?.createdAt ?? new Date(record.createdAt).toISOString(),
        });
        if (
            !list ||
            list.name !== listRow.name ||
            list.date !== listRow.date ||
            JSON.stringify(list.origin ?? null) !== JSON.stringify(listRow.origin ?? null)
        ) {
            await putLists([listRow]);
        }
        await deleteEntries(current.filter((e) => !keep.has(e.id)).map((e) => e.id));
        await putEntries(writes);
        await db.meta.put({ key: ACTIVE_PLAN_KEY, value: record.id });

        plan.value = planOf((await getList(record.id))!, await entriesOf(record.id));
        return plan.value;
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
        if (id) await deleteLists([id]);
        await db.meta.delete(ACTIVE_PLAN_KEY);
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

            // Yesterday's Abläufe are cleared out on the way in, so the tab
            // never comes back with last Sunday's songs still on it. Kept ones
            // stay: the reader saved them on purpose.
            const services = (await listsOfKind('service')).filter((l) => l.status === 'private');
            const past = services.filter((l) => isPast(l));
            if (past.length) await deleteLists(past.map((l) => l.id));
            const current = services.filter((l) => !isPast(l) && !l.keep);

            // The one this device last had open; failing that, the newest one
            // — which is how an Ablauf put together on another device turns up
            // here, ready on the Sunday.
            const active = (await db.meta.get(ACTIVE_PLAN_KEY))?.value;
            const list =
                current.find((l) => l.id === active) ??
                [...current].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            plan.value = list ? planOf(list, await entriesOf(list.id)) : null;

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

    /**
     * `verses` is sorted and de-duplicated on the way in, but not measured
     * against the hymn: the store never sees the song. Turning a selection that
     * covers every verse back into "the whole hymn" is the Strophenwahl's job,
     * because only it knows how long the hymn is.
     */
    async function addSong(songId: string, verses: VerseSelection = null): Promise<void> {
        const current = await ensurePlan();
        if (current.entries.some((entry) => entry.songId === songId)) return;
        // A new song goes after the last song, not after the last reading: a
        // plan whose order nobody touched lists its songs first and its
        // readings after them, as the page always did.
        const order = serviceItems(current).map((item) => item.key);
        const lastSong = order.findLastIndex((key) => key.startsWith('song:'));
        order.splice(lastSong + 1, 0, songItemKey(songId));
        await update({
            entries: [...current.entries, { songId, verses: normalizeVerseSelection(verses) }],
            order,
        });
    }

    /** Change which verses of a song already on the plan are sung. */
    async function setVerses(songId: string, verses: VerseSelection): Promise<void> {
        if (!plan.value) return;
        if (!plan.value.entries.some((entry) => entry.songId === songId)) return;
        await update({
            entries: plan.value.entries.map((entry) =>
                entry.songId === songId
                    ? { ...entry, verses: normalizeVerseSelection(verses) }
                    : entry,
            ),
        });
    }

    /**
     * What the Strophenwahl saves: put the song on the plan with these verses,
     * or change the verses of the one that is already on it. One call, because
     * from the panel it is one decision.
     */
    async function markSong(songId: string, verses: VerseSelection = null): Promise<void> {
        if (isInPlan(songId)) await setVerses(songId, verses);
        else await addSong(songId, verses);
    }

    /**
     * The order without one item's key. A stale key would do no harm while the
     * item is gone, but it would put the item back in its old place if it were
     * marked again — and marking again means "add it", which means the end.
     */
    function orderWithout(key: string): Partial<ServicePlan> {
        const order = plan.value?.order;
        return order ? { order: order.filter((k) => k !== key) } : {};
    }

    async function removeSong(songId: string): Promise<void> {
        if (!plan.value) return;
        await update({
            entries: plan.value.entries.filter((entry) => entry.songId !== songId),
            ...orderWithout(songItemKey(songId)),
        });
    }

    /**
     * Reorder songs and readings together, to `orderedKeys` (`ServiceItem.key`
     * each). Items missing from the list are appended, so a caller that
     * reorders only what it renders cannot drop the songs it filtered out.
     */
    async function reorder(orderedKeys: string[]): Promise<void> {
        if (!plan.value) return;
        await update(reorderPlanContents(plan.value, orderedKeys));
    }

    // --- Lesungen ---
    // Passages, not songs, so they are stored beside the entries rather than
    // among them: the song list and everything built on it (Strophenwahl,
    // adopting and saving playlists) stays about songs. Where they fall between
    // the songs is `order`'s business (see `reorder`).

    /** Put a passage on the plan, at the end; once only. */
    async function addLesung(passage: BibelPassage): Promise<void> {
        const current = await ensurePlan();
        await update({ lesungen: withPassage(current.lesungen, passage) });
    }

    /** Take a reading off, by its passageKey. */
    async function removeLesung(key: string): Promise<void> {
        if (!plan.value) return;
        await update({
            lesungen: withoutPassage(plan.value.lesungen, key),
            ...orderWithout(lesungItemKey(key)),
        });
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
        const written = await write(next);
        if (previousId && previousId !== next.id) {
            await deleteLists([previousId]);
        }
        return written;
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

    // On logout: clearUserScopedData empties the tables, this the memory and
    // which plan was open.
    async function clearAll(): Promise<void> {
        plan.value = null;
        await db.meta.delete(ACTIVE_PLAN_KEY);
    }

    // A phone that sat on the lectern overnight never reloads the app, so the
    // expiry has to be re-checked when it comes back to the foreground.
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') void pruneIfExpired();
        });
    }

    onUserDataApplied(load);
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
        lesungen,
        items,
        hasSelection,
        selectionLabel,
        isInPlan,
        versesFor,
        // Actions
        load,
        ensurePlan,
        addSong,
        setVerses,
        markSong,
        removeSong,
        reorder,
        addLesung,
        removeLesung,
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
