import { useUserStore } from '@/stores/user';

import { listDevices } from '@/api/einstieg.api';
import { handleInvalidCredentials } from '@/services/errorHandler';

/**
 * Whether this device is still one of the account's.
 *
 * Signing a device out from another one (Einstellungen › Konto) ends its
 * session on the server, but the device holds an access token that stays good
 * for up to a quarter of an hour, and it only learns of the end when it next
 * renews. Until then it went on as if nothing had happened — it could even load
 * the list of devices it was no longer in. So the app asks for that list when it
 * opens, comes back to the foreground or comes back online, and a device that
 * does not find itself in it (`current`, which the extension sets by this
 * device's id) ends its session as a refused renewal would: the songs, lists and
 * marks stay, and the sign-in asks for a code.
 *
 * Only an answer counts. A list that cannot be had — offline, a server error, an
 * extension without the route — says nothing, and a session the request found
 * ended is session.ts's to end.
 */

/** Coming back to the app every few seconds is no reason to ask each time. */
export const CHECK_INTERVAL_MS = 60_000;

let started = false;
let checking = false;
let lastAnswered = 0;

export async function checkThisDevice(): Promise<void> {
    const userStore = useUserStore();
    if (checking || !userStore.isLoggedIn || userStore.devSkipAuth) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (lastAnswered && Date.now() - lastAnswered < CHECK_INTERVAL_MS) return;

    checking = true;
    try {
        let answer: Awaited<ReturnType<typeof listDevices>>;
        try {
            answer = await listDevices();
        } catch {
            return;
        }
        lastAnswered = Date.now();

        if (!Array.isArray(answer?.devices)) return;
        if (answer.devices.some((device) => device.current)) return;
        // Signed out some other way while the list was on its way.
        if (!userStore.isLoggedIn) return;

        await handleInvalidCredentials('device_signed_out');
    } finally {
        checking = false;
    }
}

/** Wire the check to the app's life. Called once, from the shell, after the stores have loaded. */
export function startDeviceCheck(): void {
    if (started) return;
    started = true;

    const check = () => void checkThisDevice();
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
    });
    check();
}
