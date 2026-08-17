import { computed } from 'vue';
import type { Ref } from 'vue';

/**
 * Client-side password rules, shared by registration and password reset.
 *
 * These mirror the server-side validation of the deployed
 * directus-user-register-extension exactly — a divergence here would either reject
 * passwords the backend accepts or let the user submit passwords the backend rejects.
 */
export function usePasswordRules(password: Ref<string>, confirmPassword: Ref<string>) {
    const hasMinLength = computed(() => password.value.length >= 8);
    const hasUppercase = computed(() => /[A-Z]/.test(password.value));
    // Mirrors the extension's rule exactly: any digit, or any non-alphanumeric
    // non-whitespace character. A narrower list here would reject passwords the
    // backend accepts (e.g. "Passwort_x").
    const hasNumberOrSpecial = computed(() => /[0-9]|[^A-Za-z0-9\s]/.test(password.value));
    const passwordsMatch = computed(() => {
        return confirmPassword.value.length > 0 && password.value === confirmPassword.value;
    });

    const isPasswordValid = computed(() => {
        return (
            hasMinLength.value &&
            hasUppercase.value &&
            hasNumberOrSpecial.value &&
            passwordsMatch.value
        );
    });

    return {
        hasMinLength,
        hasUppercase,
        hasNumberOrSpecial,
        passwordsMatch,
        isPasswordValid,
    };
}
