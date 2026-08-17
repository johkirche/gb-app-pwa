import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { type AuthData, type UserData, db } from '@/db';

export const useUserStore = defineStore('user', () => {
    // State
    const user = ref<UserData | null>(null);
    const authData = ref<AuthData | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Dev-only auth bypass. Deliberately a plain in-memory ref, never written to
    // Dexie: a persisted flag from a dev session would survive into later production
    // builds. The router guard additionally gates on import.meta.env.DEV, so the
    // bypass is dead code in production bundles.
    const devSkipAuth = ref(false);

    // Computed
    //
    // Logged in = a cached user AND session tokens. Requiring both is defense-in-depth
    // against a hand-inserted db.users row granting access to requiresAuth routes — it
    // is NOT real authorization: client-side storage can always be forged, and every
    // server request still needs valid tokens. Login sets both (setUser), logout and
    // clearSessionData clear both, so legitimate sessions are unaffected.
    const isLoggedIn = computed(() => !!user.value && !!authData.value);
    const isActivated = computed(() => user.value?.activated || user.value?.role === 'activated');

    // Check if token is expired (with 5 minute buffer)
    const isTokenExpired = computed(() => {
        if (!authData.value) return true;
        const expiresAt = authData.value.expiresAt;
        const now = Date.now();
        const bufferMs = 5 * 60 * 1000; // 5 minutes
        return now >= expiresAt - bufferMs;
    });

    // Actions
    async function loadUserFromDB() {
        try {
            isLoading.value = true;
            error.value = null;

            // Load auth data
            const authRecords = await db.auth.toArray();
            if (authRecords.length > 0) {
                authData.value = authRecords[0];
            }

            // Load user data
            const userRecords = await db.users.toArray();
            if (userRecords.length > 0) {
                user.value = userRecords[0];
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load user data';
            console.error('Error loading user from DB:', err);
        } finally {
            isLoading.value = false;
        }
    }

    async function saveAuthData(data: AuthData) {
        try {
            await db.auth.clear();
            await db.auth.add(data);
            authData.value = data;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to save auth data';
            console.error('Error saving auth data:', err);
            throw err;
        }
    }

    async function saveUserData(data: UserData) {
        try {
            await db.users.clear();
            await db.users.add(data);
            user.value = data;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to save user data';
            console.error('Error saving user data:', err);
            throw err;
        }
    }

    async function setUser(
        userData: UserData,
        tokens: { accessToken: string; refreshToken: string; expiresAt: number },
    ) {
        try {
            await saveUserData(userData);
            await saveAuthData({
                id: 'current',
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt,
            });
        } catch (err) {
            console.error('Error setting user:', err);
            throw err;
        }
    }

    async function updateUserRole(role: string) {
        if (!user.value) return;

        const updatedUser = {
            ...user.value,
            role,
            activated: role === 'activated',
        };

        await saveUserData(updatedUser);
    }

    async function updateTokens(accessToken: string, refreshToken: string, expiresAt: number) {
        if (!authData.value) return;

        await saveAuthData({
            id: 'current',
            accessToken,
            refreshToken,
            expiresAt,
        });
    }

    function setDevSkipAuth(skip: boolean) {
        devSkipAuth.value = skip;
    }

    async function logout() {
        try {
            isLoading.value = true;
            error.value = null;

            // Clear IndexedDB
            await db.auth.clear();
            await db.users.clear();

            // Clear reactive state
            user.value = null;
            authData.value = null;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to logout';
            console.error('Error during logout:', err);
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    // Initialize store on creation - expose promise for router guard
    const initPromise = loadUserFromDB();

    return {
        // State
        user,
        authData,
        isLoading,
        error,

        // Computed
        isLoggedIn,
        isActivated,
        isTokenExpired,

        // Dev-only, in-memory
        devSkipAuth,

        // Actions
        loadUserFromDB,
        setUser,
        updateUserRole,
        updateTokens,
        setDevSkipAuth,
        logout,

        // Initialization promise
        initPromise,
    };
});
