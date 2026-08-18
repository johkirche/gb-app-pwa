import { onScopeDispose, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * Reactive `window.matchMedia`. One listener per call, torn down with the
 * owning effect scope.
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
    const matches = ref(false);

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return readonly(matches);
    }

    const mediaQuery = window.matchMedia(query);
    matches.value = mediaQuery.matches;

    const onChange = (event: MediaQueryListEvent) => {
        matches.value = event.matches;
    };

    mediaQuery.addEventListener('change', onChange);
    onScopeDispose(() => mediaQuery.removeEventListener('change', onChange));

    return readonly(matches);
}

/**
 * True from Tailwind's `lg` breakpoint up — this app's desktop line (sidebar
 * rail instead of the tab bar, wider content column). Written in rem, not px,
 * so it flips at exactly the same point as the `lg:` utility variants even when
 * the user has scaled up the browser's base font size.
 */
export function useIsDesktop(): Readonly<Ref<boolean>> {
    return useMediaQuery('(min-width: 64rem)');
}
