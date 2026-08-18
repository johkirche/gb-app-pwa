<template>
    <div class="relative flex h-full flex-col bg-background">
        <!-- Back button integrated into content -->
        <div class="absolute left-2 top-[max(0.75rem,env(safe-area-inset-top))] z-10">
            <BackButton default-href="/login" />
        </div>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]"
            >
                <header class="text-center">
                    <KeyRound class="mx-auto size-10 text-primary" aria-hidden="true" />
                    <h1 class="mt-4 font-display text-4xl font-semibold tracking-tight">
                        Passwort zurücksetzen
                    </h1>
                    <p
                        v-if="!token && !emailSent"
                        class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                    >
                        Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen Ihres
                        Passworts zu erhalten
                    </p>
                    <p
                        v-else-if="emailSent"
                        class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                    >
                        Eine E-Mail mit einem Link zum Zurücksetzen wurde gesendet
                    </p>
                    <p
                        v-else
                        class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                    >
                        Geben Sie Ihr neues Passwort ein
                    </p>
                </header>

                <!-- Email request form (no token) -->
                <form v-if="!token && !emailSent" class="mt-8" @submit.prevent="handleRequestReset">
                    <div class="space-y-2">
                        <Label for="reset-email">E-Mail</Label>
                        <Input
                            id="reset-email"
                            v-model="email"
                            type="email"
                            required
                            autocomplete="email"
                            :disabled="isLoading"
                        />
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        class="mt-6 w-full"
                        :disabled="isLoading || !email"
                    >
                        <Spinner v-if="isLoading" size="sm" class="text-primary-foreground" />
                        <span v-else>Link senden</span>
                    </Button>

                    <p v-if="error" class="mt-4 text-sm leading-relaxed text-destructive">
                        {{ error }}
                    </p>
                </form>

                <!-- Success message after email sent -->
                <div v-else-if="emailSent && !token" class="mt-8">
                    <div class="rounded-lg border border-border bg-card px-6 py-8 text-center">
                        <CircleCheck class="mx-auto size-10 text-primary" aria-hidden="true" />
                        <h2 class="mt-4 font-display text-2xl font-semibold">E-Mail gesendet!</h2>
                        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Wir haben Ihnen eine E-Mail mit einem Link zum Zurücksetzen Ihres
                            Passworts gesendet. Bitte überprüfen Sie Ihren Posteingang.
                        </p>
                    </div>

                    <Button size="lg" as-child class="mt-6 w-full">
                        <RouterLink to="/login">Zurück zur Anmeldung</RouterLink>
                    </Button>
                </div>

                <!-- Password reset form (with token) -->
                <form v-else class="mt-8" @submit.prevent="handleResetPassword">
                    <div class="space-y-5">
                        <div class="space-y-2">
                            <Label for="reset-new-password">Neues Passwort</Label>
                            <Input
                                id="reset-new-password"
                                v-model="newPassword"
                                type="password"
                                required
                                autocomplete="new-password"
                                :disabled="isLoading"
                                @focus="passwordFocused = true"
                            />
                        </div>

                        <!-- Password Requirements (same rules as registration) -->
                        <Transition name="slide-fade">
                            <div v-show="passwordFocused" class="space-y-1.5 py-1">
                                <div
                                    class="flex items-center gap-2.5 text-sm transition-colors"
                                    :class="hasMinLength ? 'text-primary' : 'text-muted-foreground'"
                                >
                                    <Check
                                        v-if="hasMinLength"
                                        class="size-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <X v-else class="size-4 shrink-0" aria-hidden="true" />
                                    <span>Mindestens 8 Zeichen</span>
                                </div>
                                <div
                                    class="flex items-center gap-2.5 text-sm transition-colors"
                                    :class="hasUppercase ? 'text-primary' : 'text-muted-foreground'"
                                >
                                    <Check
                                        v-if="hasUppercase"
                                        class="size-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <X v-else class="size-4 shrink-0" aria-hidden="true" />
                                    <span>Mindestens ein Großbuchstabe</span>
                                </div>
                                <div
                                    class="flex items-center gap-2.5 text-sm transition-colors"
                                    :class="
                                        hasNumberOrSpecial
                                            ? 'text-primary'
                                            : 'text-muted-foreground'
                                    "
                                >
                                    <Check
                                        v-if="hasNumberOrSpecial"
                                        class="size-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <X v-else class="size-4 shrink-0" aria-hidden="true" />
                                    <span>Mindestens eine Zahl oder Sonderzeichen</span>
                                </div>
                            </div>
                        </Transition>

                        <div class="space-y-2">
                            <Label for="reset-confirm-password">Passwort bestätigen</Label>
                            <Input
                                id="reset-confirm-password"
                                v-model="confirmPassword"
                                type="password"
                                required
                                autocomplete="new-password"
                                :disabled="isLoading"
                                @focus="confirmPasswordFocused = true"
                            />
                        </div>

                        <!-- Password Match -->
                        <Transition name="slide-fade">
                            <div v-show="confirmPasswordFocused" class="space-y-1.5 py-1">
                                <div
                                    class="flex items-center gap-2.5 text-sm transition-colors"
                                    :class="
                                        passwordsMatch ? 'text-primary' : 'text-muted-foreground'
                                    "
                                >
                                    <Check
                                        v-if="passwordsMatch"
                                        class="size-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <X v-else class="size-4 shrink-0" aria-hidden="true" />
                                    <span>Passwörter stimmen überein</span>
                                </div>
                            </div>
                        </Transition>
                    </div>

                    <p v-if="passwordError" class="mt-4 text-sm leading-relaxed text-destructive">
                        {{ passwordError }}
                    </p>

                    <Button
                        type="submit"
                        size="lg"
                        class="mt-6 w-full"
                        :disabled="isLoading || !isPasswordValid"
                    >
                        <Spinner v-if="isLoading" size="sm" class="text-primary-foreground" />
                        <span v-else>Passwort zurücksetzen</span>
                    </Button>

                    <p v-if="error" class="mt-4 text-sm leading-relaxed text-destructive">
                        {{ error }}
                    </p>

                    <div
                        v-if="resetSuccess"
                        class="mt-6 rounded-lg border border-border bg-card px-6 py-8 text-center"
                    >
                        <CircleCheck class="mx-auto size-10 text-primary" aria-hidden="true" />
                        <h2 class="mt-4 font-display text-2xl font-semibold">
                            Passwort zurückgesetzt!
                        </h2>
                        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Ihr Passwort wurde erfolgreich geändert.
                        </p>
                    </div>

                    <Button v-if="resetSuccess" size="lg" as-child class="mt-6 w-full">
                        <RouterLink to="/login">Zur Anmeldung</RouterLink>
                    </Button>
                </form>

                <div class="mt-6 text-center">
                    <Button variant="ghost" size="sm" as-child>
                        <RouterLink to="/login">Zurück zur Anmeldung</RouterLink>
                    </Button>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Check, CircleCheck, KeyRound, X } from 'lucide-vue-next';
import { RouterLink, useRoute } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { usePasswordRules } from '@/composables/usePasswordRules';

import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const route = useRoute();
const { requestPasswordReset, resetPassword, isLoading, error } = useAuth();

const token = ref<string | null>(null);
const email = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const emailSent = ref(false);
const resetSuccess = ref(false);
const passwordFocused = ref(false);
const confirmPasswordFocused = ref(false);

// Same rules as registration — the extension enforces them server-side only at
// registration, but a reset password weaker than the registration rules would be
// confusing and defeat their purpose.
const { hasMinLength, hasUppercase, hasNumberOrSpecial, passwordsMatch, isPasswordValid } =
    usePasswordRules(newPassword, confirmPassword);

onMounted(() => {
    // Check if there's a token in the URL query params
    const urlToken = route.query.token as string;
    if (urlToken) {
        token.value = urlToken;
    }
});

async function handleRequestReset() {
    const result = await requestPasswordReset(email.value);
    if (result.success) {
        emailSent.value = true;
    }
}

async function handleResetPassword() {
    passwordError.value = '';

    if (!hasMinLength.value || !hasUppercase.value || !hasNumberOrSpecial.value) {
        passwordError.value =
            'Das Passwort erfüllt nicht die Anforderungen: mindestens 8 Zeichen, ein Großbuchstabe und eine Zahl oder ein Sonderzeichen.';
        return;
    }

    if (newPassword.value !== confirmPassword.value) {
        passwordError.value = 'Passwörter stimmen nicht überein';
        return;
    }

    if (!token.value) {
        passwordError.value = 'Ungültiger Reset-Token';
        return;
    }

    const result = await resetPassword(token.value, newPassword.value);
    if (result.success) {
        resetSuccess.value = true;
    }
}
</script>

<style scoped>
/* Slide-fade transition (password rules reveal, mirrors RegisterPage) */
.slide-fade-enter-active {
    transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
    opacity: 0;
    transform: translateY(-10px);
    max-height: 0;
}

.slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

.slide-fade-enter-to,
.slide-fade-leave-from {
    opacity: 1;
    transform: translateY(0);
}
</style>
