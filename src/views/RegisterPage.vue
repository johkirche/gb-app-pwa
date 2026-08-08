<template>
    <ion-page>
        <ion-content :fullscreen="true">
            <div class="auth-container">
                <!-- Step Indicator -->
                <StepIndicator :current-step="currentStep" :total-steps="2" @back="goToStep1" />

                <!-- Step 1: Personal Info -->
                <div v-if="currentStep === 1" class="step-content">
                    <div class="section-header">
                        <h1 class="heading-lg">Willkommen!</h1>
                        <p class="text-muted text-muted--relaxed">
                            Erstellen Sie Ihr persönliches Konto, um auf das digitale Gesangbuch
                            zuzugreifen.
                        </p>
                    </div>

                    <form @submit.prevent="goToStep2">
                        <div class="form-stack">
                            <ion-input
                                v-model="firstName"
                                type="text"
                                label="Vorname (optional)"
                                label-placement="floating"
                                autocomplete="given-name"
                                fill="outline"
                                :disabled="isLoading"
                            ></ion-input>

                            <ion-input
                                v-model="lastName"
                                type="text"
                                label="Nachname (optional)"
                                label-placement="floating"
                                autocomplete="family-name"
                                fill="outline"
                                :disabled="isLoading"
                            ></ion-input>

                            <ion-input
                                v-model="email"
                                type="email"
                                label="E-Mail-Adresse"
                                label-placement="floating"
                                required
                                autocomplete="email"
                                fill="outline"
                                :disabled="isLoading"
                                helper-text="Wird für die Anmeldung und Passwort-Wiederherstellung verwendet"
                            ></ion-input>

                            <div class="password-input-wrapper">
                                <ion-input
                                    v-model="password"
                                    :type="showPassword ? 'text' : 'password'"
                                    label="Passwort"
                                    label-placement="floating"
                                    required
                                    autocomplete="new-password"
                                    fill="outline"
                                    :disabled="isLoading"
                                    @ionFocus="passwordFocused = true"
                                ></ion-input>
                                <ion-button
                                    fill="clear"
                                    class="password-toggle-button"
                                    aria-label="Passwort anzeigen/verbergen"
                                    @click="showPassword = !showPassword"
                                    tabindex="-1"
                                >
                                    <ion-icon
                                        slot="icon-only"
                                        :icon="showPassword ? eyeOffOutline : eyeOutline"
                                        aria-hidden="true"
                                    ></ion-icon>
                                </ion-button>
                            </div>

                            <!-- Password Requirements -->
                            <Transition name="slide-fade">
                                <div v-show="passwordFocused" class="password-rules">
                                    <div class="rule" :class="{ valid: hasMinLength }">
                                        <ion-icon
                                            :icon="
                                                hasMinLength
                                                    ? checkmarkCircleOutline
                                                    : ellipseOutline
                                            "
                                        ></ion-icon>
                                        <span>Mindestens 8 Zeichen</span>
                                    </div>
                                    <div class="rule" :class="{ valid: hasUppercase }">
                                        <ion-icon
                                            :icon="
                                                hasUppercase
                                                    ? checkmarkCircleOutline
                                                    : ellipseOutline
                                            "
                                        ></ion-icon>
                                        <span>Mindestens ein Großbuchstabe</span>
                                    </div>
                                    <div class="rule" :class="{ valid: hasNumberOrSpecial }">
                                        <ion-icon
                                            :icon="
                                                hasNumberOrSpecial
                                                    ? checkmarkCircleOutline
                                                    : ellipseOutline
                                            "
                                        ></ion-icon>
                                        <span>Mindestens eine Zahl oder Sonderzeichen</span>
                                    </div>
                                </div>
                            </Transition>

                            <div class="password-input-wrapper">
                                <ion-input
                                    v-model="confirmPassword"
                                    :type="showConfirmPassword ? 'text' : 'password'"
                                    label="Passwort bestätigen"
                                    label-placement="floating"
                                    required
                                    autocomplete="new-password"
                                    fill="outline"
                                    :disabled="isLoading"
                                    @ionFocus="confirmPasswordFocused = true"
                                ></ion-input>
                                <ion-button
                                    fill="clear"
                                    class="password-toggle-button"
                                    aria-label="Passwort anzeigen/verbergen"
                                    @click="showConfirmPassword = !showConfirmPassword"
                                    tabindex="-1"
                                >
                                    <ion-icon
                                        slot="icon-only"
                                        :icon="showConfirmPassword ? eyeOffOutline : eyeOutline"
                                        aria-hidden="true"
                                    ></ion-icon>
                                </ion-button>
                            </div>

                            <!-- Password Match -->
                            <Transition name="slide-fade">
                                <div v-show="confirmPasswordFocused" class="password-rules">
                                    <div class="rule" :class="{ valid: passwordsMatch }">
                                        <ion-icon
                                            :icon="
                                                passwordsMatch
                                                    ? checkmarkCircleOutline
                                                    : ellipseOutline
                                            "
                                        ></ion-icon>
                                        <span>Passwörter stimmen überein</span>
                                    </div>
                                </div>
                            </Transition>
                        </div>

                        <!-- Errors that point at a step 1 field (e.g. the email is already
                             taken) are raised on submit in step 2 and shown here -->
                        <ion-text v-if="error" color="danger" class="ion-margin-top">
                            <p class="error-message">{{ error }}</p>
                        </ion-text>

                        <ion-button
                            expand="block"
                            type="submit"
                            :disabled="!isStep1Valid"
                            class="ion-margin-top"
                        >
                            Weiter
                            <ion-icon slot="end" :icon="arrowForwardOutline"></ion-icon>
                        </ion-button>
                    </form>

                    <div class="section-footer">
                        <ion-text color="medium">
                            Bereits ein Konto?
                            <router-link to="/login">Anmelden</router-link>
                        </ion-text>
                    </div>
                </div>

                <!-- Step 2: Activation Code -->
                <div v-if="currentStep === 2" class="step-content">
                    <div class="section-header">
                        <h1 class="heading-lg">Aktivierungscode</h1>
                        <p class="text-muted text-muted--relaxed">
                            Geben Sie Ihren persönlichen Aktivierungscode ein. Diesen haben Sie per
                            E-Mail oder postalisch erhalten.
                        </p>
                    </div>

                    <form @submit.prevent="handleRegister">
                        <div class="form-stack">
                            <div class="code-info-box">
                                <ion-icon
                                    :icon="informationCircleOutline"
                                    class="info-icon"
                                ></ion-icon>
                                <p>
                                    Der Aktivierungscode bestätigt Ihre Berechtigung zur Nutzung des
                                    Gesangbuchs und ist nur einmal verwendbar.
                                </p>
                            </div>

                            <ion-input
                                v-model="activationCode"
                                type="text"
                                label="Aktivierungscode"
                                label-placement="floating"
                                required
                                :disabled="isLoading"
                                fill="outline"
                                placeholder="XXXX-XXXX-XXXX"
                                class="code-input"
                            ></ion-input>
                        </div>

                        <ion-text v-if="error" color="danger" class="ion-margin-top">
                            <p class="error-message">{{ error }}</p>
                        </ion-text>

                        <ion-button
                            expand="block"
                            type="submit"
                            :disabled="isLoading || !activationCode"
                            class="ion-margin-top"
                        >
                            <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
                            <span v-else>Konto erstellen</span>
                        </ion-button>

                        <ion-button
                            v-if="showDevSkip"
                            expand="block"
                            fill="clear"
                            @click="handleSkip"
                            :disabled="isLoading"
                            size="small"
                            color="medium"
                            class="ion-margin-top"
                        >
                            Überspringen (Entwicklermodus)
                        </ion-button>
                    </form>

                    <div class="section-footer">
                        <ion-text color="medium">
                            Keinen Code erhalten?
                            <a href="mailto:support@example.com">Kontaktieren Sie uns</a>
                        </ion-text>
                    </div>
                </div>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { IonButton, IonContent, IonIcon, IonInput, IonPage, IonSpinner, IonText } from '@ionic/vue';
import {
    arrowForwardOutline,
    checkmarkCircleOutline,
    ellipseOutline,
    eyeOffOutline,
    eyeOutline,
    informationCircleOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';

import StepIndicator from '@/components/utils/StepIndicator.vue';

import { USER_ALREADY_REGISTERED } from '@/services/errorHandler';

const router = useRouter();
const { register, setSkipAuth, clearError, isLoading, error } = useAuth();

// Show dev skip button only if env var is set
const showDevSkip = import.meta.env.VITE_SHOW_DEV_SKIP === 'true';

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

// Password validation rules
const hasMinLength = computed(() => password.value.length >= 8);
const hasUppercase = computed(() => /[A-Z]/.test(password.value));
// Mirrors the extension's rule exactly: any digit, or any non-alphanumeric
// non-whitespace character. A narrower list here would reject passwords the
// backend accepts (e.g. "Passwort_x").
const hasNumberOrSpecial = computed(() => /[0-9]|[^A-Za-z0-9\s]/.test(password.value));
const passwordsMatch = computed(() => {
    return confirmPassword.value.length > 0 && password.value === confirmPassword.value;
});

// Validation for Step 1
const isStep1Valid = computed(() => {
    return (
        email.value &&
        hasMinLength.value &&
        hasUppercase.value &&
        hasNumberOrSpecial.value &&
        passwordsMatch.value
    );
});

function goToStep2() {
    if (!hasMinLength.value || !passwordsMatch.value) {
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

    // The email lives on step 1, so send the user back to the field they must fix
    // instead of leaving the message on the activation-code step.
    if (result.code === USER_ALREADY_REGISTERED) {
        currentStep.value = 1;
    }
}

async function handleSkip() {
    await setSkipAuth(true);
    router.push('/home');
}
</script>

<style scoped>
/* Auth Container */
.auth-container {
    min-height: 100%;
    display: flex;
    flex-direction: column;
}

/* Step Content */
.step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
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

/* Code Info Box */
.code-info-box {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--ion-color-light);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-sm);
}

.code-info-box .info-icon {
    flex-shrink: 0;
    font-size: 1.25rem;
    color: var(--ion-color-primary);
}

.code-info-box p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--ion-color-medium);
    line-height: 1.5;
}

/* Code Input */
.code-input {
    --placeholder-opacity: 0.5;
    font-family: monospace;
    letter-spacing: 0.1em;
}

/* Password Input Wrapper */
.password-input-wrapper {
    position: relative;
}

.password-toggle-button {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    margin: 0;
    --padding-start: 8px;
    --padding-end: 8px;
}

/* Password Rules */
.password-rules {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) 0;
}

.rule {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
    color: var(--ion-color-medium);
    transition: color 0.2s ease;
}

.rule ion-icon {
    font-size: 1rem;
    flex-shrink: 0;
}

.rule.valid {
    color: var(--ion-color-success);
}

.rule.valid ion-icon {
    color: var(--ion-color-success);
}

/* Slide-fade transition */
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
