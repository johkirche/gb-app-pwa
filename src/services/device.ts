/**
 * This device, as the app names it to the server: an id made once and kept,
 * and a name the reader recognises in the list of their devices
 * (Einstellungen › Konto). An account may be signed in on four at once; the
 * register extension counts them by this id.
 *
 * The id lives in localStorage, next to the app's other data on this origin.
 * Clearing the app's data makes a new device of it, and the old one drops out
 * of the list when its session runs out. On an iPhone the home-screen app has
 * storage of its own, so it is a device of its own, apart from Safari.
 */

const KEY = 'gesangbuch.geraet';

/** What the extension expects of an id: 8 to 64 of these. */
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

let cached: string | null = null;

function newId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function deviceId(): string {
    if (cached) return cached;
    try {
        const stored = localStorage.getItem(KEY);
        if (stored && VALID.test(stored)) {
            cached = stored;
            return stored;
        }
        cached = newId();
        localStorage.setItem(KEY, cached);
    } catch {
        // No storage (a locked-down private window): a device for as long as
        // the page lives, which is as long as its session could anyway.
        cached ??= newId();
    }
    return cached;
}

function platform(userAgent: string, maxTouchPoints: number): string {
    const ua = userAgent.toLowerCase();
    if (/iphone|ipod/.test(ua)) return 'iPhone';
    // An iPad asks for the desktop site since iPadOS 13 and says "Macintosh";
    // only the touch screen gives it away (see usePWA).
    if (/ipad/.test(ua) || (/macintosh/.test(ua) && maxTouchPoints > 1)) return 'iPad';
    if (/android/.test(ua)) return /mobile/.test(ua) ? 'Android-Handy' : 'Android-Tablet';
    if (/cros/.test(ua)) return 'Chromebook';
    if (/windows/.test(ua)) return 'Windows-PC';
    if (/macintosh|mac os x/.test(ua)) return 'Mac';
    if (/linux/.test(ua)) return 'Linux-Rechner';
    return 'Gerät';
}

function browser(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    // Order matters: Edge and Samsung's browser say "Chrome" too, and every
    // browser on iOS says "Safari".
    if (/edg(e|a|ios)?\//.test(ua)) return 'Edge';
    if (/samsungbrowser/.test(ua)) return 'Samsung Internet';
    if (/firefox|fxios/.test(ua)) return 'Firefox';
    if (/crios|chrome|chromium/.test(ua)) return 'Chrome';
    if (/safari/.test(ua)) return 'Safari';
    return 'Browser';
}

/** "iPhone · Gesangbuch-App", "Windows-PC · Edge" */
export function describeDevice(
    userAgent: string,
    maxTouchPoints: number,
    standalone: boolean,
): string {
    const where = standalone ? 'Gesangbuch-App' : browser(userAgent);
    return `${platform(userAgent, maxTouchPoints)} · ${where}`;
}

function isStandalone(): boolean {
    try {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true
        );
    } catch {
        return false;
    }
}

/** What every request that gives out a session sends along as `geraet`. */
export function thisDevice(): { id: string; name: string } {
    return {
        id: deviceId(),
        name: describeDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0, isStandalone()),
    };
}
