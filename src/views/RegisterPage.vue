<template>
    <div class="flex h-full flex-col bg-background">
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
            >
                <!-- Step Indicator -->
                <StepIndicator :current-step="currentStep" :total-steps="2" @back="goToStep1" />

                <!-- Step 1: Personal Info -->
                <div
                    v-if="currentStep === 1"
                    class="step-content flex flex-1 flex-col justify-center"
                >
                    <header class="text-center">
                        <h1 class="font-display text-4xl font-semibold tracking-tight">
                            Willkommen!
                        </h1>
                        <p
                            class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                        >
                            Erstellen Sie Ihr persönliches Konto, um auf das digitale Gesangbuch
                            zuzugreifen.
                        </p>
                    </header>

                    <form class="mt-8" @submit.prevent="goToStep2">
                        <div class="space-y-5">
                            <div class="space-y-2">
                                <Label for="register-first-name">Vorname (optional)</Label>
                                <Input
                                    id="register-first-name"
                                    v-model="firstName"
                                    type="text"
                                    autocomplete="given-name"
                                    :disabled="isLoading"
                                />
                            </div>

                            <div class="space-y-2">
                                <Label for="register-last-name">Nachname (optional)</Label>
                                <Input
                                    id="register-last-name"
                                    v-model="lastName"
                                    type="text"
                                    autocomplete="family-name"
                                    :disabled="isLoading"
                                />
                            </div>

                            <div class="space-y-2">
                                <Label for="register-email">E-Mail-Adresse</Label>
                                <Input
                                    id="register-email"
                                    v-model="email"
                                    type="email"
                                    required
                                    autocomplete="email"
                                    :disabled="isLoading"
                                />
                                <p class="text-xs leading-relaxed text-muted-foreground">
                                    Wird für die Anmeldung und Passwort-Wiederherstellung verwendet
                                </p>
                            </div>

                            <div class="space-y-2">
                                <Label for="register-password">Passwort</Label>
                                <div class="relative">
                                    <Input
                                        id="register-password"
                                        v-model="password"
                                        :type="showPassword ? 'text' : 'password'"
                                        required
                                        autocomplete="new-password"
                                        class="pr-11"
                                        :disabled="isLoading"
                                        @focus="passwordFocused = true"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        class="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                                        aria-label="Passwort anzeigen/verbergen"
                                        tabindex="-1"
                                        @click="showPassword = !showPassword"
                                    >
                                        <EyeOff v-if="showPassword" aria-hidden="true" />
                                        <Eye v-else aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>

                            <!-- Password Requirements -->
                            <Transition name="slide-fade">
                                <div v-show="passwordFocused" class="space-y-1.5 py-1">
                                    <div
                                        class="flex items-center gap-2.5 text-sm transition-colors"
                                        :class="
                                            hasMinLength ? 'text-primary' : 'text-muted-foreground'
                                        "
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
                                        :class="
                                            hasUppercase ? 'text-primary' : 'text-muted-foreground'
                                        "
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
                                <Label for="register-confirm-password">Passwort bestätigen</Label>
                                <div class="relative">
                                    <Input
                                        id="register-confirm-password"
                                        v-model="confirmPassword"
                                        :type="showConfirmPassword ? 'text' : 'password'"
                                        required
                                        autocomplete="new-password"
                                        class="pr-11"
                                        :disabled="isLoading"
                                        @focus="confirmPasswordFocused = true"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        class="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                                        aria-label="Passwort anzeigen/verbergen"
                                        tabindex="-1"
                                        @click="showConfirmPassword = !showConfirmPassword"
                                    >
                                        <EyeOff v-if="showConfirmPassword" aria-hidden="true" />
                                        <Eye v-else aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>

                            <!-- Password Match -->
                            <Transition name="slide-fade">
                                <div v-show="confirmPasswordFocused" class="space-y-1.5 py-1">
                                    <div
                                        class="flex items-center gap-2.5 text-sm transition-colors"
                                        :class="
                                            passwordsMatch
                                                ? 'text-primary'
                                                : 'text-muted-foreground'
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

                        <!-- Errors that point at a step 1 field (e.g. the email is already
                             taken) are raised on submit in step 2 and shown here -->
                        <p v-if="error" class="mt-4 text-sm leading-relaxed text-destructive">
                            {{ error }}
                        </p>

                        <Button
                            type="submit"
                            size="lg"
                            class="mt-6 w-full"
                            :disabled="!isStep1Valid"
                        >
                            Weiter
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    </form>

                    <p class="mt-8 text-center text-sm text-muted-foreground">
                        Bereits ein Konto?
                        <RouterLink
                            to="/login"
                            class="font-medium text-primary underline-offset-4 hover:underline"
                        >
                            Anmelden
                        </RouterLink>
                    </p>
                </div>

                <!-- Step 2: Activation Code -->
                <div
                    v-if="currentStep === 2"
                    class="step-content flex flex-1 flex-col justify-center"
                >
                    <header class="text-center">
                        <h1 class="font-display text-4xl font-semibold tracking-tight">
                            Aktivierungscode
                        </h1>
                        <p
                            class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                        >
                            Geben Sie Ihren persönlichen Aktivierungscode ein. Diesen haben Sie per
                            E-Mail oder postalisch erhalten.
                        </p>
                    </header>

                    <form class="mt-8" @submit.prevent="handleRegister">
                        <div class="space-y-5">
                            <div class="flex gap-3 rounded-lg bg-muted p-4">
                                <Info
                                    class="mt-0.5 size-5 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <p class="text-sm leading-relaxed text-muted-foreground">
                                    Der Aktivierungscode bestätigt Ihre Berechtigung zur Nutzung des
                                    Gesangbuchs und ist nur einmal verwendbar.
                                </p>
                            </div>

                            <div class="space-y-2">
                                <Label for="register-activation-code">Aktivierungscode</Label>
                                <Input
                                    id="register-activation-code"
                                    v-model="activationCode"
                                    type="text"
                                    required
                                    :disabled="isLoading"
                                    placeholder="XXXX-XXXX-XXXX"
                                    class="font-mono tracking-[0.1em] placeholder:tracking-[0.1em]"
                                />
                            </div>
                        </div>

                        <p v-if="error" class="mt-4 text-sm leading-relaxed text-destructive">
                            {{ error }}
                        </p>

                        <Button
                            type="submit"
                            size="lg"
                            class="mt-6 w-full"
                            :disabled="isLoading || !activationCode"
                        >
                            <Spinner v-if="isLoading" size="sm" class="text-primary-foreground" />
                            <span v-else>Konto erstellen</span>
                        </Button>

                        <component :is="DevSkipButton" v-if="DevSkipButton" :disabled="isLoading" />
                    </form>

                    <p class="mt-8 text-center text-sm text-muted-foreground">
                        Keinen Code erhalten?
                        <a
                            :href="`mailto:${SUPPORT_EMAIL}`"
                            class="font-medium text-primary underline-offset-4 hover:underline"
                        >
                            Kontaktieren Sie uns
                        </a>
                    </p>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';

import { ArrowRight, Check, Eye, EyeOff, Info, X } from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { usePasswordRules } from '@/composables/usePasswordRules';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import StepIndicator from '@/components/utils/StepIndicator.vue';

import { SUPPORT_EMAIL } from '@/config/support';
import { REGISTRATION_LOGIN_FAILED, USER_ALREADY_REGISTERED } from '@/services/errorHandler';

const router = useRouter();
const { register, clearError, isLoading, error } = useAuth();

// Dev-only skip button, loaded via a DEV-guarded dynamic import so production
// builds emit neither the chunk nor its strings (a plain v-if compiles to an
// unref() call that terser cannot fold away).
const DevSkipButton =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_SKIP === 'true'
        ? defineAsyncComponent(() => import('@/components/dev/DevSkipButton.vue'))
        : null;

// Step management
const currentStep = ref(1);

// Form fields
const activationCode = ref('');
const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const passwordFocused = ref(false);
const confirmPasswordFocused = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// Password validation rules (shared with PasswordResetPage; mirror the extension)
const { hasMinLength, hasUppercase, hasNumberOrSpecial, passwordsMatch, isPasswordValid } =
    usePasswordRules(password, confirmPassword);

// Validation for Step 1
const isStep1Valid = computed(() => {
    return Boolean(email.value) && isPasswordValid.value;
});

function goToStep2() {
    if (!isPasswordValid.value) {
        return;
    }

    clearError();
    currentStep.value = 2;
}

function goToStep1() {
    clearError();
    currentStep.value = 1;
}

async function handleRegister() {
    if (!activationCode.value) {
        return;
    }

    const result = await register(
        email.value,
        password.value,
        activationCode.value,
        firstName.value || undefined,
        lastName.value || undefined,
    );

    if (result.success) {
        // Navigate to onboarding after successful registration
        router.push('/onboarding');
        return;
    }

    // The account WAS created but the automatic login failed (the extension already
    // consumed the one-time activation code, so retrying the registration could only
    // yield USER_ALREADY_REGISTERED). Send the user to the login page, where the
    // reason banner explains what happened.
    if (result.code === REGISTRATION_LOGIN_FAILED) {
        router.push({ path: '/login', query: { reason: 'registration_login_failed' } });
        return;
    }

    // The email lives on step 1, so send the user back to the field they must fix
    // instead of leaving the message on the activation-code step.
    if (result.code === USER_ALREADY_REGISTERED) {
        currentStep.value = 1;
    }
}
</script>

<style scoped>
/* Step entry animation */
.step-content {
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateX(10px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Slide-fade transition (password rules reveal) */
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
