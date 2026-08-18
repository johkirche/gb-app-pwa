import { type Ref, nextTick, onActivated, watch } from 'vue';

/**
 * KeepAlive detaches the DOM subtree on deactivation, which resets every inner
 * scroll container to 0 on re-insertion — and by the time onDeactivated fires
 * the DOM is already detached, so the position must be tracked continuously.
 * Restore it after re-attach on activate (parity with Ionic's page caching).
 */
export function useKeepAliveScroll(scrollEl: Ref<HTMLElement | null>) {
    let saved = 0;

    function onScroll(event: Event) {
        saved = (event.target as HTMLElement).scrollTop;
    }

    watch(
        scrollEl,
        (el, _prev, onCleanup) => {
            if (!el) return;
            el.addEventListener('scroll', onScroll, { passive: true });
            onCleanup(() => el.removeEventListener('scroll', onScroll));
        },
        { immediate: true, flush: 'post' },
    );

    onActivated(() => {
        if (saved > 0) {
            nextTick(() => {
                if (scrollEl.value) scrollEl.value.scrollTop = saved;
            });
        }
    });
}
