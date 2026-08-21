import { describe, expect, it } from 'vitest';

import type { ServicePlan } from '@/db';

import {
    createPlan,
    daysFromToday,
    endOfDay,
    formatExpiryHint,
    formatServiceDate,
    fromIsoDate,
    isPlanExpired,
    toIsoDate,
    toPlainPlan,
    todayIsoDate,
} from './plan';

// A Sunday morning, local time — the day a service selection is made.
const SUNDAY_MORNING = new Date(2026, 7, 23, 9, 30);

describe('toIsoDate', () => {
    it('formats a local date, not a UTC one', () => {
        // 00:30 local on the 23rd is still the 22nd in UTC for CEST; the date
        // input and the expiry both mean the local day.
        expect(toIsoDate(new Date(2026, 7, 23, 0, 30))).toBe('2026-08-23');
        expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
});

describe('fromIsoDate', () => {
    it('reads a date back as local midnight', () => {
        const date = fromIsoDate('2026-08-23');
        expect(date?.getFullYear()).toBe(2026);
        expect(date?.getMonth()).toBe(7);
        expect(date?.getDate()).toBe(23);
        expect(date?.getHours()).toBe(0);
    });

    it('rejects anything that is not a plain ISO date', () => {
        expect(fromIsoDate('')).toBeNull();
        expect(fromIsoDate('23.08.2026')).toBeNull();
        expect(fromIsoDate('2026-08-23T10:00:00Z')).toBeNull();
    });
});

describe('endOfDay', () => {
    it('is the last millisecond of that local day', () => {
        const expiry = new Date(endOfDay('2026-08-23', SUNDAY_MORNING));
        expect(toIsoDate(expiry)).toBe('2026-08-23');
        expect(expiry.getHours()).toBe(23);
        expect(expiry.getMinutes()).toBe(59);
        expect(expiry.getSeconds()).toBe(59);
    });

    it('falls back to today rather than expiring a plan on the spot', () => {
        // A stored date the app cannot parse must not make the selection vanish
        // the moment it is read back.
        expect(endOfDay('kaputt', SUNDAY_MORNING)).toBeGreaterThan(SUNDAY_MORNING.getTime());
    });
});

describe('createPlan', () => {
    it('derives the expiry from the date it is for', () => {
        const plan = createPlan(
            { title: 'Gottesdienst', date: '2026-08-23', entries: [{ songId: 'a' }] },
            { now: SUNDAY_MORNING },
        );

        expect(plan.date).toBe('2026-08-23');
        expect(plan.expiresAt).toBe(endOfDay('2026-08-23', SUNDAY_MORNING));
        expect(isPlanExpired(plan, SUNDAY_MORNING.getTime())).toBe(false);
        // Same day, one minute past midnight afterwards
        expect(isPlanExpired(plan, new Date(2026, 7, 24, 0, 1).getTime())).toBe(true);
    });

    it('falls back to today and to a default title', () => {
        const plan = createPlan({ title: '   ', entries: [] }, { now: SUNDAY_MORNING });

        expect(plan.date).toBe(todayIsoDate(SUNDAY_MORNING));
        expect(plan.title).toBe('Gottesdienst');
        expect(plan.origin).toBeNull();
    });

    it('copies the entries it is handed', () => {
        const entries = [{ songId: 'a' }];
        const plan = createPlan({ title: 'Gottesdienst', entries }, { now: SUNDAY_MORNING });

        entries[0].songId = 'b';
        expect(plan.entries[0].songId).toBe('a');
    });

    it('keeps where an adopted plan came from', () => {
        const fetchedAt = new Date(2026, 7, 23, 8, 0);
        const plan = createPlan(
            { title: 'Erntedank', entries: [{ songId: 'a' }] },
            {
                origin: { providerId: 'playlist', offerId: 'p1', label: 'Erntedank', fetchedAt },
                now: SUNDAY_MORNING,
            },
        );

        expect(plan.origin).toEqual({
            providerId: 'playlist',
            offerId: 'p1',
            label: 'Erntedank',
            fetchedAt,
        });
    });
});

describe('toPlainPlan', () => {
    it('deep-copies what Dexie has to structured-clone', () => {
        const plan: ServicePlan = createPlan(
            { title: 'Gottesdienst', date: '2026-08-23', entries: [{ songId: 'a' }] },
            { now: SUNDAY_MORNING },
        );

        const copy = toPlainPlan(plan);
        copy.entries[0].songId = 'b';

        expect(plan.entries[0].songId).toBe('a');
        expect(copy.createdAt).not.toBe(plan.createdAt);
        expect(copy.createdAt.getTime()).toBe(plan.createdAt.getTime());
    });
});

describe('daysFromToday', () => {
    it('counts calendar days, not 24-hour spans', () => {
        // Late in the evening, tomorrow is still exactly one day away.
        const lateSunday = new Date(2026, 7, 23, 23, 45);
        expect(daysFromToday('2026-08-24', lateSunday)).toBe(1);
        expect(daysFromToday('2026-08-23', lateSunday)).toBe(0);
        expect(daysFromToday('2026-08-22', lateSunday)).toBe(-1);
    });

    it('survives a daylight-saving switch', () => {
        // The CEST → CET switch falls on 25.10.2026; that day is 25 hours long.
        const beforeSwitch = new Date(2026, 9, 24, 12, 0);
        expect(daysFromToday('2026-10-26', beforeSwitch)).toBe(2);
    });
});

describe('formatServiceDate', () => {
    it('names the days close by', () => {
        expect(formatServiceDate('2026-08-23', SUNDAY_MORNING)).toBe('Heute');
        expect(formatServiceDate('2026-08-24', SUNDAY_MORNING)).toBe('Morgen');
        expect(formatServiceDate('2026-08-22', SUNDAY_MORNING)).toBe('Gestern');
    });

    it('spells out anything further away', () => {
        expect(formatServiceDate('2026-08-30', SUNDAY_MORNING)).toContain('30.08.2026');
    });
});

describe('formatExpiryHint', () => {
    it('promises the cleanup in plain words', () => {
        expect(formatExpiryHint('2026-08-23', SUNDAY_MORNING)).toBe(
            'Wird heute Abend automatisch entfernt.',
        );
        expect(formatExpiryHint('2026-08-24', SUNDAY_MORNING)).toBe(
            'Wird morgen Abend automatisch entfernt.',
        );
        expect(formatExpiryHint('2026-08-30', SUNDAY_MORNING)).toContain('30.08.2026');
    });
});
