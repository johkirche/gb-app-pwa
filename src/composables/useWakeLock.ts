import {
    type MaybeRefOrGetter,
    type Ref,
    onScopeDispose,
    readonly,
    ref,
    toValue,
    watch,
} from 'vue';

/**
 * The screen wake lock, shared by everyone who asks for it.
 *
 * The platform grants a document one sentinel, not one per component, so this
 * is deliberately module state: every caller adds a *hold*, the lock is taken
 * while at least one hold stands and dropped when the last one goes. Two
 * screens can therefore ask at once — the song page today, the
 * Gottesdienst-Modus (#32) and a running MIDI sequence (#29/#30) later —
 * without either of them being able to pull the lock out from under the other.
 *
 * Two things the platform does on its own are handled here:
 *
 * - The browser releases the lock whenever the page is hidden and never gives
 *   it back by itself, so it is re-taken on `visibilitychange`. A request made
 *   while the page is hidden is rejected outright, which is why the hold and
 *   the sentinel are tracked separately: the hold survives the trip to the
 *   background, the sentinel does not.
 * - `request()` rejects for reasons that are none of the caller's business
 *   (low battery, an OS policy, no support at all). All of them mean the same
 *   thing here — the screen dims as it always did — so they are swallowed.
 *
 * And one thing it does not: a hold is not a promise to burn the battery all
 * afternoon. The lock also stands down after a quarter of an hour in which
 * nobody touched the page, and the next touch takes it straight back — so the
 * hold outlives the dimming and the reader never has to find the switch again.
 */

/** One entry per caller currently asking for the screen to stay on. */
const holders = new Set<symbol>();

const held = ref(false);

/**
 * How long a hold keeps the screen awake with nothing happening on the page.
 * Long enough for any hymn and the words between two, short enough that a
 * phone left face-up in the pew stops burning through the afternoon.
 */
export const WAKE_LOCK_IDLE_MS = 15 * 60 * 1000;

/**
 * What counts as the reader still being there. Deliberately not `scroll`: the
 * app turns pages by scrolling them itself, and it must not be able to keep
 * its own lock alive.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;

let sentinel: WakeLockSentinel | null = null;
/** Serializes request/release so two rapid holds cannot take two sentinels. */
let queue: Promise<void> = Promise.resolve();
let listening = false;

let idleTimer: ReturnType<typeof setTimeout> | null = null;
/** True once the quarter hour has run out; cleared by the next sign of life. */
let idle = false;

export function isWakeLockSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

function onSentinelRelease(event: Event) {
    const released = event.target as WakeLockSentinel;
    released.removeEventListener('release', onSentinelRelease);
    if (sentinel === released) {
        sentinel = null;
        held.value = false;
    }
}

function startIdleTimer() {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        idleTimer = null;
        idle = true;
        sync();
    }, WAKE_LOCK_IDLE_MS);
}

function stopIdleTimer() {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
    idle = false;
}

/** The reader is still there: the quarter hour starts over, and the lock with it. */
function noteActivity() {
    if (holders.size === 0) return;
    startIdleTimer();
    if (!idle) return;
    idle = false;
    sync();
}

async function step() {
    const wanted = holders.size > 0 && !idle && document.visibilityState === 'visible';

    if (wanted && !sentinel) {
        try {
            const granted = await navigator.wakeLock.request('screen');
            // The last hold may have gone while the request was in flight.
            if (holders.size === 0) {
                await granted.release().catch(() => {});
                return;
            }
            granted.addEventListener('release', onSentinelRelease);
            sentinel = granted;
            held.value = true;
        } catch {
            held.value = false;
        }
        return;
    }

    if (!wanted && sentinel) {
        const current = sentinel;
        sentinel = null;
        held.value = false;
        await current.release().catch(() => {});
    }
}

function sync() {
    queue = queue.then(step, step);
}

function onVisibilityChange() {
    // Coming back to the page is the reader returning, so the quarter hour
    // starts over with them — the one that ran while the page was in the
    // background measured a screen that was never theirs to lose.
    if (document.visibilityState === 'visible' && holders.size > 0) {
        idle = false;
        startIdleTimer();
    }
    sync();
}

function listen() {
    if (listening) return;
    listening = true;
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Capture, so a handler that stops propagation cannot hide the reader from
    // us; passive, so nothing here can hold up a scroll.
    for (const type of ACTIVITY_EVENTS) {
        document.addEventListener(type, noteActivity, { capture: true, passive: true });
    }
}

export interface WakeLockHandle {
    /** False where the platform has no Screen Wake Lock API — everything no-ops. */
    isSupported: boolean;
    /** Whether a lock is actually held right now (by anyone). */
    isActive: Readonly<Ref<boolean>>;
    /** Add this caller's hold, and start its quarter hour. Idempotent. */
    request: () => void;
    /** Drop this caller's hold. Idempotent; runs by itself on scope dispose. */
    release: () => void;
}

/**
 * Keep the screen awake for as long as this caller says so — and as long as
 * the page is being used: {@link WAKE_LOCK_IDLE_MS} without a touch, a key or
 * a wheel drops the lock until the next one.
 *
 * Pass a reactive source to have the hold follow it, or leave it out and drive
 * the hold by hand. Either way the hold is dropped when the owning component
 * (or effect scope) goes away.
 *
 * ```ts
 * useWakeLock(() => preferences.keepScreenAwake);
 * ```
 */
export function useWakeLock(source?: MaybeRefOrGetter<boolean>): WakeLockHandle {
    const id = Symbol('wake-lock-hold');
    const isSupported = isWakeLockSupported();

    function request() {
        if (!isSupported || holders.has(id)) return;
        holders.add(id);
        // Asking is itself a sign of life — opening a song starts the clock.
        idle = false;
        startIdleTimer();
        listen();
        sync();
    }

    function release() {
        if (!holders.delete(id)) return;
        if (holders.size === 0) stopIdleTimer();
        sync();
    }

    if (source !== undefined) {
        watch(
            () => toValue(source),
            (on) => (on ? request() : release()),
            { immediate: true },
        );
    }

    // failSilently: a caller outside a component (a store, a plain script) owns
    // its own release, which is a legitimate way to use this.
    onScopeDispose(release, true);

    return { isSupported, isActive: readonly(held), request, release };
}
