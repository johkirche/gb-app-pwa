import { computed, ref } from 'vue';

// Store the deferred prompt globally so it persists across component instances
let deferredPrompt: any = null;
const canInstallRef = ref(false);
const isStandaloneRef = ref(false);
// Heuristic: if beforeinstallprompt doesn't fire after a delay, we suspect the app is installed
const isSuspectedInstalledRef = ref(false);
// Loading state while checking installation status
const isCheckingInstallRef = ref(true);
// The app reported its own installation while this tab was open. Nothing
// else can tell us: the page carries on running in the browser, so the
// display mode stays 'browser' until it is opened from the home screen.
const wasInstalledRef = ref(false);
// The browser confirmed, when asked, that the app is on this device: Chrome on
// Android (84 and up) looks for the WebAPK bound to the manifest's
// `related_applications` entry. Only a yes means anything. An empty answer
// also comes from an app added as a plain shortcut, which is installed all the
// same, and from every browser that implements the call without the check.
const isKnownInstalledRef = ref(false);
let isListening = false;
let beforeInstallPromptFired = false;

// Check if running in standalone/PWA mode
function checkStandaloneMode(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
    );
}

/**
 * Whether this page runs as the installed app, for code outside a component
 * (the router's guard), and before or without `initPWAListeners`.
 */
export function isRunningStandalone(): boolean {
    try {
        return isStandaloneRef.value || checkStandaloneMode();
    } catch {
        return false;
    }
}

// Not in lib.dom yet: Chromium only, and still marked experimental.
type InstalledRelatedApp = { platform: string; url?: string; id?: string };
type NavigatorWithRelatedApps = Navigator & {
    getInstalledRelatedApps?: () => Promise<InstalledRelatedApp[]>;
};

async function askWhetherInstalled(): Promise<boolean> {
    const nav = navigator as NavigatorWithRelatedApps;
    if (typeof nav.getInstalledRelatedApps !== 'function') return false;
    try {
        const apps = await nav.getInstalledRelatedApps();
        return apps.some((app) => app.platform === 'webapp');
    } catch (error) {
        // Refused outside a secure context or a top-level frame. Not knowing
        // is the state we were already in.
        console.warn('PWA: getInstalledRelatedApps failed:', error);
        return false;
    }
}

/**
 * An iPhone, iPod or iPad. Since iPadOS 13 an iPad asks for the desktop site by
 * default, so Safari on it sends a Mac's user agent ("Macintosh") and the word
 * "iPad" never appears. The touch screen gives it away: no Mac has one.
 */
function detectIOS(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return true;
    return /macintosh/.test(userAgent) && navigator.maxTouchPoints > 1;
}

export function usePWA() {
    // Platform detection
    const isIOS = computed(detectIOS);

    const isAndroid = computed(() => {
        const userAgent = navigator.userAgent.toLowerCase();
        return /android/.test(userAgent);
    });

    // Use the reactive ref for standalone detection
    const isStandalone = computed(() => isStandaloneRef.value);

    const canInstall = computed(() => canInstallRef.value && !isStandaloneRef.value);

    // Check if install button should be shown (Android/Desktop with prompt, or iOS with instructions)
    const showInstallButton = computed(() => {
        return canInstallRef.value && !isStandaloneRef.value;
    });

    // Initialize listeners (call once in main.ts or App.vue)
    function initPWAListeners() {
        if (isListening) return;
        isListening = true;

        console.log('PWA: Initializing listeners');
        console.log('PWA: User Agent', navigator.userAgent);

        // Check standalone mode
        const standalone = checkStandaloneMode();
        isStandaloneRef.value = standalone;
        console.log('PWA: Standalone mode:', standalone);

        // Listen for display mode changes (e.g., when switching between browser and PWA)
        const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)');
        standaloneMediaQuery.addEventListener('change', (e) => {
            console.log('PWA: Display mode changed, standalone:', e.matches);
            isStandaloneRef.value = e.matches;
        });

        // Capture the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e: Event) => {
            console.log('PWA: beforeinstallprompt fired');
            beforeInstallPromptFired = true;
            isCheckingInstallRef.value = false;
            e.preventDefault();
            deferredPrompt = e;
            canInstallRef.value = true;
            // If beforeinstallprompt fires, the app is definitely NOT installed
            isSuspectedInstalledRef.value = false;
            console.log('PWA: canInstallRef set to true, app is NOT installed');
        });

        // Handle successful installation
        window.addEventListener('appinstalled', () => {
            console.log('PWA: appinstalled fired');
            deferredPrompt = null;
            canInstallRef.value = false;
            isSuspectedInstalledRef.value = false; // Now we know for sure, no need to suspect
            wasInstalledRef.value = true;
            beforeInstallPromptFired = false;
        });

        // Ask the browser outright. Where it can say yes, that settles the check
        // well before the timer below would have guessed.
        if (!standalone) {
            void askWhetherInstalled().then((installed) => {
                if (!installed || isStandaloneRef.value) return;
                console.log('PWA: getInstalledRelatedApps found the app');
                isKnownInstalledRef.value = true;
                isSuspectedInstalledRef.value = false;
                isCheckingInstallRef.value = false;
            });
        }

        // After a delay, if beforeinstallprompt hasn't fired (and we're not on iOS),
        // we suspect the app might be installed
        setTimeout(() => {
            isCheckingInstallRef.value = false;
            if (
                !beforeInstallPromptFired &&
                !isStandaloneRef.value &&
                !isKnownInstalledRef.value &&
                !isIOS.value
            ) {
                console.log('PWA: No install prompt after delay, suspecting app is installed');
                isSuspectedInstalledRef.value = true;
            }
        }, 1500);
    }

    // Trigger the install prompt
    async function installPWA(): Promise<boolean> {
        console.log('PWA: installPWA called. deferredPrompt exists:', !!deferredPrompt);
        if (!deferredPrompt) return false;

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('PWA: User choice outcome:', outcome);

            if (outcome === 'accepted') {
                deferredPrompt = null;
                canInstallRef.value = false;
                // Not every browser follows an accepted prompt with an
                // `appinstalled` event, so record it here as well.
                wasInstalledRef.value = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error('PWA: Error during PWA installation:', error);
            return false;
        }
    }

    return {
        isIOS,
        isAndroid,
        isStandalone,
        canInstall,
        showInstallButton,
        isSuspectedInstalled: isSuspectedInstalledRef,
        wasInstalled: wasInstalledRef,
        isKnownInstalled: isKnownInstalledRef,
        isCheckingInstall: isCheckingInstallRef,
        initPWAListeners,
        installPWA,
    };
}
