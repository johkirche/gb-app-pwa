import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { preferShareSheet, shareDataFor, shareSong } from '@/composables/useShareSong';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('vue-sonner', () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}));

const song = { id: 'abc', index: 122, titel: 'Großer Gott, wir loben dich' };

function stubNavigator(overrides: Record<string, unknown>) {
    for (const [key, value] of Object.entries(overrides)) {
        Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
    }
}

function stubPointer(coarse: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({ matches: coarse && query.includes('coarse') }),
    });
}

describe('shareDataFor (Issue #34)', () => {
    it('nennt das Lied, wie es angesagt wird, und verlinkt seine Nummer', () => {
        expect(shareDataFor(song, 'https://gesangbuch.example')).toEqual({
            title: '122. Großer Gott, wir loben dich',
            text: '122. Großer Gott, wir loben dich – Gesangbuch der Johannischen Kirche',
            url: 'https://gesangbuch.example/lied/122',
        });
    });

    it('lässt die Nummer weg, wo das Buch keine vergeben hat', () => {
        expect(shareDataFor({ id: 'x', index: 0, titel: 'Ohne Nummer' }, 'https://h').title).toBe(
            'Ohne Nummer',
        );
    });
});

describe('preferShareSheet', () => {
    it('will das Teilen-Blatt nur mit Finger und Share-API', () => {
        const coarse = { matchMedia: () => ({ matches: true }) } as unknown as Window;
        const fine = { matchMedia: () => ({ matches: false }) } as unknown as Window;
        const withShare = { share: () => Promise.resolve() } as unknown as Navigator;
        const without = {} as Navigator;

        expect(preferShareSheet(withShare, coarse)).toBe(true);
        expect(preferShareSheet(withShare, fine)).toBe(false);
        expect(preferShareSheet(without, coarse)).toBe(false);
    });
});

describe('shareSong', () => {
    const originalShare = navigator.share;
    const originalCanShare = navigator.canShare;
    const originalClipboard = navigator.clipboard;
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        toastSuccess.mockReset();
        toastError.mockReset();
    });

    afterEach(() => {
        stubNavigator({
            share: originalShare,
            canShare: originalCanShare,
            clipboard: originalClipboard,
        });
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: originalMatchMedia,
        });
    });

    it('öffnet auf dem Telefon das Teilen-Blatt', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        stubNavigator({ share, canShare: undefined, clipboard: undefined });
        stubPointer(true);

        await expect(shareSong(song)).resolves.toBe('shared');
        expect(share).toHaveBeenCalledWith(
            expect.objectContaining({ url: `${window.location.origin}/lied/122` }),
        );
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('sagt nichts, wenn das Blatt weggewischt wird', async () => {
        const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
        stubNavigator({ share, canShare: undefined, clipboard: undefined });
        stubPointer(true);

        await expect(shareSong(song)).resolves.toBe('dismissed');
        expect(toastError).not.toHaveBeenCalled();
    });

    it('kopiert am Schreibtisch und bestätigt es', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        stubNavigator({ share: undefined, canShare: undefined, clipboard: { writeText } });
        stubPointer(false);

        await expect(shareSong(song)).resolves.toBe('copied');
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/lied/122`);
        expect(toastSuccess).toHaveBeenCalledWith('Link kopiert', expect.anything());
    });

    it('kopiert auch dort, wo ein Desktop-Browser eine Share-API hat', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn().mockResolvedValue(undefined);
        stubNavigator({ share, canShare: undefined, clipboard: { writeText } });
        stubPointer(false);

        await expect(shareSong(song)).resolves.toBe('copied');
        expect(share).not.toHaveBeenCalled();
    });

    it('greift zum Teilen-Blatt, wenn die Zwischenablage versagt', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        stubNavigator({ share, canShare: undefined, clipboard: { writeText } });
        stubPointer(false);

        await expect(shareSong(song)).resolves.toBe('shared');
    });

    it('meldet, wenn es keinen Weg hinaus gibt', async () => {
        stubNavigator({ share: undefined, canShare: undefined, clipboard: undefined });
        stubPointer(false);

        await expect(shareSong(song)).resolves.toBe('failed');
        expect(toastError).toHaveBeenCalled();
    });
});
