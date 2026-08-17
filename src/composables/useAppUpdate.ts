import { toastController } from '@ionic/vue';
import { registerSW } from 'virtual:pwa-register';

// Module-level guard so the service worker is only registered once,
// no matter how many callers use this composable (mirrors usePWA.ts).
let initialized = false;

export function useAppUpdate() {
    // Initialize the update prompt (call once in main.ts)
    function initUpdatePrompt() {
        if (initialized) return;
        initialized = true;

        const updateSW = registerSW({
            immediate: true,
            onNeedRefresh: async () => {
                const toast = await toastController.create({
                    message: 'Eine neue Version des Gesangbuchs ist verfügbar.',
                    position: 'bottom',
                    // Stay visible until the user acts on it
                    duration: 0,
                    buttons: [
                        {
                            text: 'Aktualisieren',
                            role: 'confirm',
                            handler: () => {
                                // Activates the waiting service worker and reloads
                                updateSW(true);
                            },
                        },
                        {
                            text: 'Später',
                            role: 'cancel',
                        },
                    ],
                });
                await toast.present();
            },
            onOfflineReady: async () => {
                const toast = await toastController.create({
                    message: 'Das Gesangbuch ist jetzt offline verfügbar.',
                    duration: 3000,
                    position: 'bottom',
                });
                await toast.present();
            },
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
