import { registerSW } from 'virtual:pwa-register';
import { toast } from 'vue-sonner';

// Module-level guard so the service worker is only registered once,
// no matter how many callers use this composable (mirrors usePWA.ts).
let initialized = false;

export function useAppUpdate() {
    // Initialize the update prompt (call once after the app is mounted, so the
    // <Toaster /> in App.vue is guaranteed to be listening)
    function initUpdatePrompt() {
        if (initialized) return;
        initialized = true;

        const updateSW = registerSW({
            immediate: true,
            onNeedRefresh: () => {
                toast('Eine neue Version des Gesangbuchs ist verfügbar.', {
                    // Stay visible until the user acts on it (Ionic duration 0
                    // meant persistent; vue-sonner needs Infinity for that)
                    duration: Infinity,
                    action: {
                        label: 'Aktualisieren',
                        onClick: () => {
                            // Activates the waiting service worker and reloads
                            updateSW(true);
                        },
                    },
                    cancel: {
                        label: 'Später',
                        onClick: () => {},
                    },
                });
            },
            // No toast on onOfflineReady. It fires the first time a worker
            // installs, which is the first visit to the start page, before any
            // account or any song: „offline verfügbar" there was untrue. What is
            // true then is only the app's shell; the book is offline once the
            // download step says so („Das Gesangbuch ist jetzt auf diesem Gerät").
            onRegisteredSW: (_swUrl, registration) => {
                if (registration) {
                    // Check for a new deployment every hour so long-running tabs
                    // eventually see the update toast without a manual reload
                    setInterval(
                        () => {
                            registration.update();
                        },
                        60 * 60 * 1000,
                    );
                }
            },
            onRegisterError: (error) => {
                // console.error survives the production terser config: only
                // log/info/debug are stripped (pure_funcs in vite.config.ts)
                console.error('SW registration failed:', error);
            },
        });
    }

    return {
        initUpdatePrompt,
    };
}
