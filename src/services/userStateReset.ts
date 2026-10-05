/**
 * Personal state kept in memory, reset on logout.
 *
 * The tables behind it are cleared by clearUserScopedData (errorHandler.ts);
 * what a store has already read into memory has to be dropped as well, or the
 * next account on a shared device would see it until the app reloads. A store
 * holding such state registers its reset here once, when it is created, so
 * logout does not need to know every store by name.
 */

type Reset = () => void | Promise<void>;

const resets = new Set<Reset>();

export function registerUserStateReset(reset: Reset): void {
    resets.add(reset);
}

export async function resetRegisteredUserState(): Promise<void> {
    for (const reset of resets) {
        try {
            await reset();
        } catch (err) {
            console.error('Error resetting user state:', err);
        }
    }
}
