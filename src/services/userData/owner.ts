import { useUserStore } from '@/stores/user';

/**
 * Whose lists these are: the signed-in account, or nobody yet.
 *
 * The derived ids of an account's Favoriten, Lesezeichen and marks contain it,
 * so two of that account's devices arrive at the same ids (see ids.ts).
 */
export function currentOwnerId(): string | null {
    const userStore = useUserStore();
    return userStore.devSkipAuth ? null : (userStore.user?.id ?? null);
}
