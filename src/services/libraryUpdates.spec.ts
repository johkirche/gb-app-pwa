import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * When the app brings a corrected Gesangbuch in by itself, and when it asks.
 * The stores are stand-ins: what is under test is the decision, not the sync.
 */

const { songsStore, userStore, toast, mayUseMobileData } = await vi.hoisted(async () => {
    const { reactive } = await import('vue');
    return {
        songsStore: {
            isSyncing: false,
            isDemo: false,
            hasSongs: true,
            failedFiles: [] as { id: string; filename: string }[],
            countPendingUpdates: vi.fn(),
            syncAll: vi.fn(),
        },
        // Reactive, as the real store is: the start-up wiring watches it.
        userStore: reactive({ isLoggedIn: true }),
        toast: { success: vi.fn(), info: vi.fn() },
        mayUseMobileData: vi.fn(() => false),
    };
});

vi.mock('@/stores/songs', () => ({ useSongsStore: () => songsStore }));
vi.mock('@/stores/user', () => ({ useUserStore: () => userStore }));
vi.mock('@/utils/mobileData', () => ({ mayUseMobileData }));
vi.mock('vue-sonner', () => ({ toast }));

type Module = typeof import('./libraryUpdates');
let updates: Module;

beforeEach(async () => {
    // Fresh module state per test: the throttle and the once-per-session prompt
    // live at module level, as they do in the app.
    vi.resetModules();
    updates = await import('./libraryUpdates');

    Object.assign(songsStore, { isSyncing: false, isDemo: false, hasSongs: true, failedFiles: [] });
    userStore.isLoggedIn = true;
    songsStore.countPendingUpdates.mockReset().mockResolvedValue(1);
    songsStore.syncAll.mockReset().mockResolvedValue(undefined);
    toast.success.mockReset();
    toast.info.mockReset();
    mayUseMobileData.mockReset().mockReturnValue(false);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('updateAction', () => {
    it.each([
        [null, false, 'none'],
        [0, true, 'none'],
        [1, true, 'sync'],
        [25, true, 'sync'],
        [26, true, 'ask'],
        [565, false, 'sync'],
    ] as const)('%s songs, mobile data %s: %s', (pending, mobileData, action) => {
        expect(updates.updateAction(pending, mobileData)).toBe(action);
    });
});

describe('checkLibraryUpdates', () => {
    it('brings a small update in quietly and says so', async () => {
        await updates.checkLibraryUpdates();

        expect(songsStore.syncAll).toHaveBeenCalledWith({ quiet: true });
        expect(toast.success).toHaveBeenCalledOnce();
    });

    it('does nothing when nothing moved', async () => {
        songsStore.countPendingUpdates.mockResolvedValue(0);

        await updates.checkLibraryUpdates();

        expect(songsStore.syncAll).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('brings a large update in at a desk without asking', async () => {
        songsStore.countPendingUpdates.mockResolvedValue(400);

        await updates.checkLibraryUpdates();

        expect(songsStore.syncAll).toHaveBeenCalledOnce();
        expect(toast.info).not.toHaveBeenCalled();
    });

    it('asks first on a phone that may be on mobile data, and syncs on the answer', async () => {
        songsStore.countPendingUpdates.mockResolvedValue(400);
        mayUseMobileData.mockReturnValue(true);

        await updates.checkLibraryUpdates();

        expect(songsStore.syncAll).not.toHaveBeenCalled();
        expect(toast.info).toHaveBeenCalledOnce();
        expect(toast.info.mock.calls[0][0]).toBe('Neuerungen für 400 Lieder');

        await toast.info.mock.calls[0][1].action.onClick();
        expect(songsStore.syncAll).toHaveBeenCalledWith({ quiet: true });
    });

    it('asks only once per session', async () => {
        vi.useFakeTimers();
        songsStore.countPendingUpdates.mockResolvedValue(400);
        mayUseMobileData.mockReturnValue(true);

        await updates.checkLibraryUpdates();
        vi.advanceTimersByTime(updates.CHECK_INTERVAL_MS);
        await updates.checkLibraryUpdates();

        expect(songsStore.countPendingUpdates).toHaveBeenCalledTimes(2);
        expect(toast.info).toHaveBeenCalledOnce();
    });

    it('says nothing when the sync fails', async () => {
        songsStore.syncAll.mockRejectedValue(new Error('Network down'));

        await updates.checkLibraryUpdates();

        expect(toast.success).not.toHaveBeenCalled();
    });

    it('does not claim success while files are missing', async () => {
        songsStore.syncAll.mockImplementation(async () => {
            songsStore.failedFiles = [{ id: 'mxml-1', filename: '1.mxl' }];
        });

        await updates.checkLibraryUpdates();

        expect(toast.success).not.toHaveBeenCalled();
    });

    it.each([
        ['without a session', () => (userStore.isLoggedIn = false)],
        ['in a demo', () => (songsStore.isDemo = true)],
        ['before the first download', () => (songsStore.hasSongs = false)],
        ['while a sync is running', () => (songsStore.isSyncing = true)],
    ])('does not ask the server %s', async (_case, arrange) => {
        arrange();

        await updates.checkLibraryUpdates();

        expect(songsStore.countPendingUpdates).not.toHaveBeenCalled();
    });

    it('does not ask the server while offline', async () => {
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

        await updates.checkLibraryUpdates();

        expect(songsStore.countPendingUpdates).not.toHaveBeenCalled();
        onLine.mockRestore();
    });

    it('waits before asking again once it had an answer', async () => {
        vi.useFakeTimers();
        songsStore.countPendingUpdates.mockResolvedValue(0);

        await updates.checkLibraryUpdates();
        vi.advanceTimersByTime(updates.CHECK_INTERVAL_MS - 1000);
        await updates.checkLibraryUpdates();
        expect(songsStore.countPendingUpdates).toHaveBeenCalledOnce();

        vi.advanceTimersByTime(1000);
        await updates.checkLibraryUpdates();
        expect(songsStore.countPendingUpdates).toHaveBeenCalledTimes(2);
    });

    it('asks again at once after a check that got no answer', async () => {
        songsStore.countPendingUpdates.mockResolvedValueOnce(null).mockResolvedValueOnce(1);

        await updates.checkLibraryUpdates();
        await updates.checkLibraryUpdates();

        expect(songsStore.countPendingUpdates).toHaveBeenCalledTimes(2);
        expect(songsStore.syncAll).toHaveBeenCalledOnce();
    });
});

describe('startLibraryUpdates', () => {
    it('checks on start, on coming back, and when a session begins', async () => {
        vi.useFakeTimers();
        songsStore.countPendingUpdates.mockResolvedValue(0);
        userStore.isLoggedIn = false;

        updates.startLibraryUpdates();
        await vi.runAllTimersAsync();
        // No session yet: the start-up check had nothing to go on.
        expect(songsStore.countPendingUpdates).not.toHaveBeenCalled();

        userStore.isLoggedIn = true;
        await vi.runAllTimersAsync();
        expect(songsStore.countPendingUpdates).toHaveBeenCalledOnce();

        vi.advanceTimersByTime(updates.CHECK_INTERVAL_MS);
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.runAllTimersAsync();
        expect(songsStore.countPendingUpdates).toHaveBeenCalledTimes(2);
    });
});
