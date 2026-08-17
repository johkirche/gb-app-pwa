<template>
    <ion-page>
        <ion-content :fullscreen="true">
            <!-- Back button integrated into content -->
            <ion-button
                fill="clear"
                class="back-button floating-button floating-button--top-left"
                @click="$router.back()"
            >
                <ion-icon slot="icon-only" :icon="arrowBackOutline"></ion-icon>
            </ion-button>

            <div class="auth-container">
                <div class="section-header">
                    <ion-icon :icon="keyOutline" class="icon-hero"></ion-icon>
                    <h1 class="heading-lg">Passwort zurücksetzen</h1>
                    <p v-if="!token && !emailSent" class="text-muted text-muted--relaxed">
                        Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen Ihres
                        Passworts zu erhalten
                    </p>
                    <p v-else-if="emailSent" class="text-muted text-muted--relaxed">
                        Eine E-Mail mit einem Link zum Zurücksetzen wurde gesendet
                    </p>
                    <p v-else class="text-muted text-muted--relaxed">
                        Geben Sie Ihr neues Passwort ein
                    </p>
                </div>

                <!-- Email request form (no token) -->
                <form v-if="!token && !emailSent" @submit.prevent="handleRequestReset">
                    <ion-input
                        v-model="email"
                        type="email"
                        label="E-Mail"
                        label-placement="floating"
                        required
                        autocomplete="email"
                        fill="outline"
                        :disabled="isLoading"
                    ></ion-input>

                    <ion-button
                        expand="block"
                        type="submit"
                        :disabled="isLoading || !email"
                        class="ion-margin-top"
                    >
                        <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
                        <span v-else>Link senden</span>
                    </ion-button>

                    <ion-text v-if="error" color="danger" class="ion-margin-top">
                        <p class="error-message">{{ error }}</p>
                    </ion-text>
                </form>

                <!-- Success message after email sent -->
                <div v-else-if="emailSent && !token">
                    <ion-text color="success">
                        <div class="result-box result-box--success">
                            <ion-icon
                                :icon="checkmarkCircleOutline"
                                class="result-box__icon"
                            ></ion-icon>
                            <h2 class="result-box__title">E-Mail gesendet!</h2>
                            <p class="result-box__message">
                                Wir haben Ihnen eine E-Mail mit einem Link zum Zurücksetzen Ihres
                                Passworts gesendet. Bitte überprüfen Sie Ihren Posteingang.
                            </p>
                        </div>
                    </ion-text>

                    <ion-button expand="block" router-link="/login" class="ion-margin-top">
                        Zurück zur Anmeldung
                    </ion-button>
                </div>

                <!-- Password reset form (with token) -->
                <form v-else @submit.prevent="handleResetPassword">
                    <div class="form-stack">
                        <ion-input
                            v-model="newPassword"
                            type="password"
                            label="Neues Passwort"
                            label-placement="floating"
                            required
                            autocomplete="new-password"
                            fill="outline"
                            :disabled="isLoading"
                            @ionFocus="passwordFocused = true"
                        ></ion-input>

                        <!-- Password Requirements (same rules as registration) -->
                        <Transition name="slide-fade">
                            <div v-show="passwordFocused" class="password-rules">
                                <div class="rule" :class="{ valid: hasMinLength }">
                                    <ion-icon
                                        :icon="
                                            hasMinLength ? checkmarkCircleOutline : ellipseOutline
                                        "
                                    ></ion-icon>
                                    <span>Mindestens 8 Zeichen</span>
                                </div>
                                <div class="rule" :class="{ valid: hasUppercase }">
                                    <ion-icon
                                        :icon="
                                            hasUppercase ? checkmarkCircleOutline : ellipseOutline
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

                        <ion-input
                            v-model="confirmPassword"
                            type="password"
                            label="Passwort bestätigen"
                            label-placement="floating"
                            required
                            autocomplete="new-password"
                            fill="outline"
                            :disabled="isLoading"
                            @ionFocus="confirmPasswordFocused = true"
                        ></ion-input>

                        <!-- Password Match -->
                        <Transition name="slide-fade">
                            <div v-show="confirmPasswordFocused" class="password-rules">
                                <div class="rule" :class="{ valid: passwordsMatch }">
                                    <ion-icon
                                        :icon="
                                            passwordsMatch ? checkmarkCircleOutline : ellipseOutline
                                        "
                                    ></ion-icon>
                                    <span>Passwörter stimmen überein</span>
                                </div>
                            </div>
                        </Transition>
                    </div>

                    <ion-text v-if="passwordError" color="danger" class="ion-margin-top">
                        <p class="error-message">{{ passwordError }}</p>
                    </ion-text>

                    <ion-button
                        expand="block"
                        type="submit"
                        :disabled="isLoading || !isPasswordValid"
                        class="ion-margin-top"
                    >
                        <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
                        <span v-else>Passwort zurücksetzen</span>
                    </ion-button>

                    <ion-text v-if="error" color="danger" class="ion-margin-top">
                        <p class="error-message">{{ error }}</p>
                    </ion-text>

                    <ion-text v-if="resetSuccess" color="success" class="ion-margin-top">
                        <div class="result-box result-box--success">
                            <ion-icon
                                :icon="checkmarkCircleOutline"
                                class="result-box__icon"
                            ></ion-icon>
                            <h2 class="result-box__title">Passwort zurückgesetzt!</h2>
                            <p class="result-box__message">
                                Ihr Passwort wurde erfolgreich geändert.
                            </p>
                        </div>
                    </ion-text>

                    <ion-button
                        v-if="resetSuccess"
                        expand="block"
                        router-link="/login"
                        class="ion-margin-top"
                    >
                        Zur Anmeldung
                    </ion-button>
                </form>

                <div class="back-link ion-margin-top">
                    <ion-button fill="clear" router-link="/login">Zurück zur Anmeldung</ion-button>
                </div>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { IonButton, IonContent, IonIcon, IonInput, IonPage, IonSpinner, IonText } from '@ionic/vue';
import {
    arrowBackOutline,
    checkmarkCircleOutline,
    ellipseOutline,
    keyOutline,
} from 'ionicons/icons';
import { useRoute } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { usePasswordRules } from '@/composables/usePasswordRules';

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
/* PasswordResetPage - uses global result-box classes from variables.css */
.back-link {
    text-align: center;
}

/* Password Rules (mirrors RegisterPage) */
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
