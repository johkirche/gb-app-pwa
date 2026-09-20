import { watch } from 'vue';

import { usePreferencesStore } from '@/stores/preferences';

/** The custom property main.css reads the reader's Größe back out of. */
const PAGE_SCALE_PROPERTY = '--page-scale';

/**
 * Put the stored Größe on the root element, where the root font size picks it
 * up (see main.css). One factor, written in one place, so the setting reaches
 * every page rather than only the one that happens to read the store.
 */
export function applyPageScale(scale: number) {
    document.documentElement.style.setProperty(PAGE_SCALE_PROPERTY, String(scale));
}

/**
 * Keep the root in step with the preference. Call once from the app shell.
 *
 * Watched rather than read once: the preferences load from IndexedDB after the
 * first paint, and both the Einstellungen slider and the song page's menu write
 * to the same value while the app is running.
 */
export function usePageScale() {
    const preferencesStore = usePreferencesStore();

    watch(() => preferencesStore.pageScale, applyPageScale, { immediate: true });
}
