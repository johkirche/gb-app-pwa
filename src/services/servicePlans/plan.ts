import type { BibelPassage, ServiceEntry, ServicePlan, ServicePlanOrigin } from '@/db';
import { passageKey, toPassages } from '@/utils/bibelPassage';

import type { ServicePlanDraft } from './types';

/** What an unnamed selection is called on screen. */
export const DEFAULT_SERVICE_TITLE = 'Gottesdienst';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `yyyy-mm-dd` in local time — the form `<input type="date">` speaks. */
export function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function todayIsoDate(now: Date = new Date()): string {
    return toIsoDate(now);
}

/** Local midnight of an ISO date, or null if it is not one. */
export function fromIsoDate(isoDate: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return null;
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The last millisecond of that day, in local time — when a plan for it dies.
 * An unparsable date would otherwise expire instantly and take the selection
 * with it, so it is treated as "today".
 */
export function endOfDay(isoDate: string, now: Date = new Date()): number {
    const date = fromIsoDate(isoDate) ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

export function isPlanExpired(plan: ServicePlan, now: number = Date.now()): boolean {
    return now > plan.expiresAt;
}

export function entriesFromSongIds(songIds: string[]): ServiceEntry[] {
    return songIds.map((songId) => ({ songId }));
}

/**
 * A plain copy of one entry. `verses` is copied out rather than carried along:
 * an entry read back from the store hands out the reactive proxy Vue wrapped
 * its array in, and Dexie cannot structured-clone that (DataCloneError).
 */
export function toPlainEntry(entry: ServiceEntry): ServiceEntry {
    return { ...entry, verses: entry.verses ? [...entry.verses] : entry.verses };
}

/** Turn a draft into a storable plan. Its expiry always follows its date. */
export function createPlan(
    draft: ServicePlanDraft,
    options: { origin?: ServicePlanOrigin | null; now?: Date } = {},
): ServicePlan {
    const now = options.now ?? new Date();
    const date = draft.date || todayIsoDate(now);

    return {
        id: crypto.randomUUID(),
        title: draft.title.trim() || DEFAULT_SERVICE_TITLE,
        date,
        entries: draft.entries.map(toPlainEntry),
        expiresAt: endOfDay(date, now),
        origin: options.origin ? { ...options.origin } : null,
        // Only where there are any: a plan without readings stays shaped like
        // every plan stored before the field existed.
        ...(draft.lesungen?.length ? { lesungen: toPassages(draft.lesungen) } : {}),
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * A plain, structured-cloneable copy. Dexie cannot store the reactive proxy a
 * plan picks up once it lives in the store (DataCloneError), and the nested
 * entries need copying too.
 */
export function toPlainPlan(plan: ServicePlan): ServicePlan {
    return {
        ...plan,
        entries: plan.entries.map(toPlainEntry),
        origin: plan.origin ? { ...plan.origin } : null,
        ...(plan.lesungen ? { lesungen: toPassages(plan.lesungen) } : {}),
        ...(plan.order ? { order: [...plan.order] } : {}),
        createdAt: new Date(plan.createdAt),
        updatedAt: new Date(plan.updatedAt),
    };
}

/** One thing on the plan — a song or a reading — as the Gottesdienst lists it. */
export type ServiceItem =
    | { kind: 'song'; key: string; entry: ServiceEntry }
    | { kind: 'lesung'; key: string; passage: BibelPassage };

export function songItemKey(songId: string): string {
    return `song:${songId}`;
}

/** By the reading's passageKey, which is what the page hands back to remove one. */
export function lesungItemKey(key: string): string {
    return `lesung:${key}`;
}

type PlanContents = Pick<ServicePlan, 'entries' | 'lesungen' | 'order'>;

/**
 * Put `items` in the order `keys` names. Whatever the keys do not name is
 * appended in the order it came, so a partial or stale order can never drop
 * anything — the same rule the song lists follow.
 */
function orderByKeys<T extends { key: string }>(items: T[], keys: string[]): T[] {
    const byKey = new Map(items.map((item) => [item.key, item]));
    const ordered = [...new Set(keys)]
        .map((key) => byKey.get(key))
        .filter((item): item is T => item !== undefined);
    const placed = new Set(ordered.map((item) => item.key));
    return [...ordered, ...items.filter((item) => !placed.has(item.key))];
}

/**
 * Songs and readings in one list, in the order the service holds them. A plan
 * never reordered — and every plan stored before it could be — lists its songs
 * first and its readings after them, as the page always did.
 */
export function serviceItems(plan: PlanContents): ServiceItem[] {
    const items: ServiceItem[] = [
        ...plan.entries.map(
            (entry): ServiceItem => ({ kind: 'song', key: songItemKey(entry.songId), entry }),
        ),
        ...(plan.lesungen ?? []).map(
            (passage): ServiceItem => ({
                kind: 'lesung',
                key: lesungItemKey(passageKey(passage)),
                passage,
            }),
        ),
    ];
    return orderByKeys(items, plan.order ?? []);
}

/**
 * The plan's contents reordered to `keys`. Songs and readings are each put in
 * the same relative order as the whole, so the song swipe and a playlist saved
 * from the plan follow what the page shows.
 */
export function reorderPlanContents(plan: PlanContents, keys: string[]): Required<PlanContents> {
    const items = orderByKeys(serviceItems(plan), keys);
    return {
        entries: items.flatMap((item) => (item.kind === 'song' ? [item.entry] : [])),
        lesungen: items.flatMap((item) => (item.kind === 'lesung' ? [item.passage] : [])),
        order: items.map((item) => item.key),
    };
}

/** How many days from today that date is; negative for the past. */
export function daysFromToday(isoDate: string, now: Date = new Date()): number | null {
    const date = fromIsoDate(isoDate);
    if (!date) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((date.getTime() - today.getTime()) / MS_PER_DAY);
}

/** "Heute", "Morgen", otherwise "Sonntag, 24.08.2026". */
export function formatServiceDate(isoDate: string, now: Date = new Date()): string {
    const offset = daysFromToday(isoDate, now);
    if (offset === 0) return 'Heute';
    if (offset === 1) return 'Morgen';
    if (offset === -1) return 'Gestern';

    const date = fromIsoDate(isoDate);
    if (!date) return '';
    return new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

/** The line that promises the selection cleans itself up. */
export function formatExpiryHint(isoDate: string, now: Date = new Date()): string {
    const offset = daysFromToday(isoDate, now);
    if (offset === null) return '';
    if (offset <= 0) return 'Wird heute Abend automatisch entfernt.';
    if (offset === 1) return 'Wird morgen Abend automatisch entfernt.';
    return `Wird am ${formatServiceDate(isoDate, now)} am Abend automatisch entfernt.`;
}

/**
 * What a plan holds, in words: "3 Lieder", "3 Lieder · 1 Lesung". The readings
 * are named only where there are any, and the songs only where there are
 * some or nothing else — a plan of one reading is "1 Lesung", not "0 Lieder".
 */
export function formatSelectionCount(songCount: number, lesungCount = 0): string {
    const songs = songCount === 1 ? '1 Lied' : `${songCount} Lieder`;
    const lesungen = lesungCount === 1 ? '1 Lesung' : `${lesungCount} Lesungen`;
    if (lesungCount === 0) return songs;
    if (songCount === 0) return lesungen;
    return `${songs} · ${lesungen}`;
}
