import type { ServiceEntry, ServicePlan, ServicePlanOrigin } from '@/db';

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
        entries: draft.entries.map((entry) => ({ ...entry })),
        expiresAt: endOfDay(date, now),
        origin: options.origin ? { ...options.origin } : null,
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
        entries: plan.entries.map((entry) => ({ ...entry })),
        origin: plan.origin ? { ...plan.origin } : null,
        createdAt: new Date(plan.createdAt),
        updatedAt: new Date(plan.updatedAt),
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
