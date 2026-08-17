<template>
    <ion-page>
        <ion-content :fullscreen="true">
            <div class="auth-container auth-container--centered">
                <div class="section-header">
                    <ion-img src="/logo.svg" alt="Logo" class="logo logo--md" />
                    <h1 class="heading-xl">Gesangbuch</h1>
                    <p class="text-muted">Melden Sie sich an, um fortzufahren</p>
                </div>

                <!-- Show logout reason message if present -->
                <div v-if="logoutMessage" class="info-banner ion-margin-bottom">
                    <ion-icon :icon="informationCircle"></ion-icon>
                    <ion-text>
                        <strong>{{ logoutMessage }}</strong>
                    </ion-text>
                </div>

                <form @submit.prevent="handleLogin">
                    <div class="form-stack">
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

                        <ion-input
                            v-model="password"
                            type="password"
                            label="Passwort"
                            label-placement="floating"
                            required
                            fill="outline"
                            autocomplete="current-password"
                            :disabled="isLoading"
                        ></ion-input>
                    </div>

                    <div v-if="error" class="error-banner ion-margin-top">
                        <ion-icon :icon="alertCircle"></ion-icon>
                        <ion-text>
                            <strong>{{ error }}</strong>
                        </ion-text>
                    </div>

                    <ion-button
                        expand="block"
                        type="submit"
                        :disabled="isLoading"
                        class="ion-margin-top"
                    >
                        <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
                        <span v-else>Anmelden</span>
                    </ion-button>

                    <ion-button
                        expand="block"
                        fill="clear"
                        router-link="/password-reset"
                        :disabled="isLoading"
                        size="small"
                        class="ion-margin-top"
                    >
                        Passwort vergessen?
                    </ion-button>

                    <div class="divider-text">
                        <span class="divider-text__text">oder</span>
                    </div>

                    <ion-button
                        expand="block"
                        fill="outline"
                        router-link="/register"
                        :disabled="isLoading"
                    >
                        Neues Konto erstellen
                    </ion-button>

                    <component :is="DevSkipButton" v-if="DevSkipButton" :disabled="isLoading" />
                </form>

                <div class="legal-links">
                    <ion-button fill="clear" size="small" color="medium" router-link="/impressum">
                        Impressum
                    </ion-button>
                    <span class="legal-links__separator">·</span>
                    <ion-button fill="clear" size="small" color="medium" router-link="/datenschutz">
                        Datenschutz
                    </ion-button>
                </div>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref, watch } from 'vue';

import {
    IonButton,
    IonContent,
    IonIcon,
    IonImg,
    IonInput,
    IonPage,
    IonSpinner,
    IonText,
} from '@ionic/vue';
import { alertCircle, informationCircle } from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';

import { useAuth } from '@/composables/useAuth';

import { LOGOUT_REASON_MESSAGES, type LogoutReason } from '@/services/errorHandler';

const router = useRouter();
const route = useRoute();
const { login, isLoading, error } = useAuth();
const songsStore = useSongsStore();

const email = ref('');
const password = ref('');

// Dev-only skip button, loaded via a DEV-guarded dynamic import so production
// builds emit neither the chunk nor its strings (a plain v-if compiles to an
// unref() call that terser cannot fold away).
const DevSkipButton =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_SKIP === 'true'
        ? defineAsyncComponent(() => import('@/components/dev/DevSkipButton.vue'))
        : null;

function resolveLogoutMessage(reason: unknown): string | null {
    if (typeof reason !== 'string') return null;
    const message = LOGOUT_REASON_MESSAGES[reason as LogoutReason];
    return typeof message === 'string' ? message : null;
}

// The reason banner must survive the URL cleanup below, so the message is latched
// into a ref: captured once at setup (covers fresh mounts, e.g. the hard redirect
// to /login?reason=account_deleted) and updated whenever a NEW reason arrives on
// the route (covers Ionic reusing this page instance, e.g. the push to
// /login?reason=registration_login_failed from the register page). A computed over
// the live route would blank the banner the moment the query is stripped.
const logoutMessage = ref<string | null>(resolveLogoutMessage(route.query.reason));

watch(
    () => route.query.reason,
    (reason) => {
        const message = resolveLogoutMessage(reason);
        if (message) {
            logoutMessage.value = message;
        }
    },
);

// Clear the reason from URL after displaying (optional, for cleaner URL)
onMounted(() => {
    if (route.query.reason) {
        // Remove the reason from URL after a short delay to avoid flash
        setTimeout(() => {
            router.replace({ path: '/login', query: {} });
        }, 100);
    }
});

async function handleLogin() {
    if (!email.value || !password.value) {
        return;
    }

    const result = await login(email.value, password.value);

    if (result.success) {
        // Check if user has downloaded data
        const hasData = songsStore.songs.length > 0;

        // If no data, go to onboarding; otherwise go to the songs tab
        if (!hasData) {
            router.push('/onboarding');
        } else {
            router.push('/tabs/lieder');
        }
    }
}
</script>

<style scoped>
.info-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(var(--ion-color-warning-rgb), 0.15);
    border-left: 4px solid var(--ion-color-warning);
    border-radius: 8px;
}

.info-banner ion-icon {
    font-size: 24px;
    flex-shrink: 0;
    color: var(--ion-color-warning-shade);
}

.info-banner ion-text {
    flex: 1;
    color: var(--ion-text-color);
}

.error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(var(--ion-color-danger-rgb), 0.1);
    border-left: 4px solid var(--ion-color-danger);
    border-radius: 8px;
}

.error-banner ion-icon {
    font-size: 24px;
    flex-shrink: 0;
    color: var(--ion-color-danger);
}

.error-banner ion-text {
    flex: 1;
    color: var(--ion-color-danger);
}

.legal-links {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 16px;
}

.legal-links ion-button {
    font-size: 0.75rem;
    text-transform: none;
}

.legal-links__separator {
    color: var(--ion-color-medium);
    font-size: 0.75rem;
}
</style>
