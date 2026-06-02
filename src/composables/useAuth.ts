import { computed } from 'vue';

import { passwordRequest, passwordReset, readMe, refresh } from '@directus/sdk';

import { useUserStore } from '@/stores/user';

import type { UserData } from '@/db';
import { directusClient } from '@/services/directus';
import {
    extractDirectusErrorMessage,
    handleApiError,
    isInvalidCredentialsError,
} from '@/services/errorHandler';

/**
 * Endpoint path of the directus-user-register-extension.
 * Directus mounts endpoint extensions under their name, so the route exposed by
 * `router.post('/register', ...)` lives at `/<extension-name>/register`.
 */
const REGISTER_ENDPOINT = '/directus-user-register-extension/register';

/**
 * Refresh auth token - exported separately for use in API modules
 */
export async function refreshAuthToken(): Promise<boolean> {
    try {
        const userStore = useUserStore();
        const refreshToken = userStore.authData?.refreshToken;

        if (!refreshToken) {
            return false;
        }

        const result = await directusClient.request(
            refresh({
                refresh_token: refreshToken,
                mode: 'json',
            }),
        );

        if (result.access_token && result.refresh_token) {
            const expiresAt = Date.now() + (result.expires || 900000);
            await userStore.updateTokens(result.access_token, result.refresh_token, expiresAt);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error refreshing token:', error);

        // Check for invalid credentials error (user account deleted)
        if (isInvalidCredentialsError(error)) {
            await handleApiError(error);
            return false;
        }

        return false;
    }
}

export function useAuth() {
    const userStore = useUserStore();

    // Computed properties from store
    const isLoggedIn = computed(() => userStore.isLoggedIn);
    const isActivated = computed(() => userStore.isActivated);
    const skipAuth = computed(() => userStore.skipAuth);
    const user = computed(() => userStore.user);
    const isLoading = computed(() => userStore.isLoading);
    const error = computed(() => userStore.error);

    // Login function
    async function login(email: string, password: string) {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            // Login with Directus SDK
            const result = await directusClient.login({ email, password });

            if (!result.access_token || !result.refresh_token) {
                throw new Error('Invalid response from server');
            }

            // Calculate token expiration (default 15 minutes)
            const expiresAt = Date.now() + (result.expires || 900000);

            // Fetch user data
            const userData = await directusClient.request(
                readMe({
                    fields: ['id', 'email', 'first_name', 'last_name', 'role'],
                }),
            );

            // Map user data to our format
            const user: UserData = {
                id: userData.id,
                email: userData.email,
                firstName: userData.first_name,
                lastName: userData.last_name,
                role:
                    typeof userData.role === 'string'
                        ? userData.role
                        : userData.role?.name || 'user',
                activated: userData.role === 'activated' || userData.role?.name === 'activated',
                skipAuth: false,
            };

            // Save to store and IndexedDB
            await userStore.setUser(user, {
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                expiresAt,
            });

            return { success: true, user };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed';
            userStore.error = errorMessage;
            console.error('Login error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Register function - includes activation code validation
    async function register(
        email: string,
        password: string,
        activationCode: string,
        firstName?: string,
        lastName?: string,
    ) {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            // Combined name kept for backwards compatibility with older extension builds
            // that only read a single `name` field.
            const name = [firstName, lastName].filter(Boolean).join(' ').trim();

            // Register via the directus-user-register-extension. It validates the
            // registration code, creates an activated user and marks the code as used.
            // The Directus SDK expects a *command function* returning the request
            // options; `method` must be set explicitly (it defaults to GET otherwise)
            // and Content-Type defaults to application/json.
            await directusClient.request(() => ({
                path: REGISTER_ENDPOINT,
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                    registration_code: activationCode,
                    first_name: firstName,
                    last_name: lastName,
                    name: name || undefined,
                }),
            }));

            // After successful registration with valid code, automatically log in
            return await login(email, password);
        } catch (err) {
            const errorMessage = extractDirectusErrorMessage(err) ?? 'Registration failed';
            userStore.error = errorMessage;
            console.error('Registration error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Note: Activation is handled during registration via the register extension endpoint
    // (see REGISTER_ENDPOINT). No separate activation step is needed.

    // Request password reset
    async function requestPasswordReset(email: string) {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            await directusClient.request(
                passwordRequest(email, `${window.location.origin}/password-reset`),
            );

            return { success: true };
        } catch (err) {
            const errorMessage = extractDirectusErrorMessage(err) ?? 'Failed to send reset email';
            userStore.error = errorMessage;
            console.error('Password reset request error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Reset password with token
    async function resetPassword(token: string, password: string) {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            await directusClient.request(passwordReset(token, password));

            return { success: true };
        } catch (err) {
            const errorMessage = extractDirectusErrorMessage(err) ?? 'Password reset failed';
            userStore.error = errorMessage;
            console.error('Password reset error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Logout function
    async function logout() {
        try {
            userStore.isLoading = true;

            // Logout from Directus
            try {
                await directusClient.logout();
            } catch (err) {
                console.warn('Directus logout failed, continuing with local logout:', err);
            }

            // Clear local data
            await userStore.logout();

            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Logout failed';
            userStore.error = errorMessage;
            console.error('Logout error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Refresh token if needed
    async function ensureValidToken() {
        if (userStore.isTokenExpired && userStore.authData?.refreshToken) {
            return await refreshAuthToken();
        }
        return true;
    }

    // Skip auth for dev purposes
    async function setSkipAuth(skip: boolean) {
        await userStore.setSkipAuth(skip);
    }

    return {
        // State
        isLoggedIn,
        isActivated,
        skipAuth,
        user,
        isLoading,
        error,

        // Methods
        login,
        register,
        logout,
        requestPasswordReset,
        resetPassword,
        ensureValidToken,
        setSkipAuth,
    };
}
