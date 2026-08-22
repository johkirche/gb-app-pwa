import { type Ref, onBeforeUnmount, ref } from 'vue';

/**
 * Today's date, kept current.
 *
 * A phone that sits on the lectern never reloads the app, so a `new Date()`
 * read once at setup goes stale: anything derived from it is still showing
 * last week days later. This re-reads the clock at midnight and whenever the
 * app comes back to the foreground (a sleeping device does not fire timers on
 * time, so neither trigger is enough on its own).
 */
export function useCurrentDate(): Ref<Date> {
    const now = ref(new Date());
    let timer: ReturnType<typeof setTimeout> | undefined;

    function refresh() {
        const next = new Date();
        // Only publish a new date once the day itself has turned — an hourly
        // wake-up must not invalidate everything computed from it.
        if (next.toDateString() !== now.value.toDateString()) {
            now.value = next;
        }
    }

    function scheduleMidnight() {
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 500);
        timer = setTimeout(() => {
            refresh();
            scheduleMidnight();
        }, midnight.getTime() - Date.now());
    }

    function onVisible() {
        if (document.visibilityState === 'visible') refresh();
    }

    scheduleMidnight();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);

    onBeforeUnmount(() => {
        if (timer) clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', refresh);
    });

    return now;
}
