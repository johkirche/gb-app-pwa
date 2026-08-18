<template>
    <div class="flex h-full flex-col bg-background">
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]"
            >
                <header class="text-center">
                    <img src="/logo.svg" alt="Logo" class="mx-auto h-28 w-28" />
                    <h1 class="mt-5 font-display text-5xl font-semibold tracking-tight">
                        Gesangbuch
                    </h1>
                    <p class="mt-3 text-sm text-muted-foreground">
                        Melden Sie sich an, um fortzufahren
                    </p>
                </header>

                <!-- Show logout reason message if present -->
                <div
                    v-if="logoutMessage"
                    class="mt-8 flex items-start gap-3 rounded-lg border-l-4 border-gold bg-gold/10 px-4 py-3"
                >
                    <Info class="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
                    <p class="text-sm leading-relaxed">
                        <strong class="font-medium">{{ logoutMessage }}</strong>
                    </p>
                </div>

                <form class="mt-8" @submit.prevent="handleLogin">
                    <div class="space-y-5">
                        <div class="space-y-2">
                            <Label for="login-email">E-Mail</Label>
                            <Input
                                id="login-email"
                                v-model="email"
                                type="email"
                                required
                                autocomplete="email"
                                :disabled="isLoading"
                            />
                        </div>

                        <div class="space-y-2">
                            <Label for="login-password">Passwort</Label>
                            <Input
                                id="login-password"
                                v-model="password"
                                type="password"
                                required
                                autocomplete="current-password"
                                :disabled="isLoading"
                            />
                        </div>
                    </div>

                    <div
                        v-if="error"
                        class="mt-5 flex items-start gap-3 rounded-lg border-l-4 border-destructive bg-destructive/10 px-4 py-3"
                    >
                        <CircleAlert
                            class="mt-0.5 size-5 shrink-0 text-destructive"
                            aria-hidden="true"
                        />
                        <p class="text-sm leading-relaxed text-destructive">
                            <strong class="font-medium">{{ error }}</strong>
                        </p>
                    </div>

                    <Button type="submit" size="lg" class="mt-6 w-full" :disabled="isLoading">
                        <Spinner v-if="isLoading" size="sm" class="text-primary-foreground" />
                        <span v-else>Anmelden</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        as-child
                        class="mt-3 w-full"
                        :class="isLoading ? 'pointer-events-none opacity-50' : ''"
                    >
                        <RouterLink to="/password-reset" :aria-disabled="isLoading || undefined">
                            Passwort vergessen?
                        </RouterLink>
                    </Button>

                    <div class="my-5 flex items-center gap-4" aria-hidden="true">
                        <Separator class="flex-1" />
                        <span class="text-xs text-muted-foreground">oder</span>
                        <Separator class="flex-1" />
                    </div>

                    <Button
                        variant="outline"
                        as-child
                        class="w-full"
                        :class="isLoading ? 'pointer-events-none opacity-50' : ''"
                    >
                        <RouterLink to="/register" :aria-disabled="isLoading || undefined">
                            Neues Konto erstellen
                        </RouterLink>
                    </Button>

                    <component :is="DevSkipButton" v-if="DevSkipButton" :disabled="isLoading" />
                </form>

                <div
                    class="mt-10 flex items-center justify-center gap-3 text-xs text-muted-foreground"
                >
                    <RouterLink to="/impressum" class="transition-colors hover:text-foreground">
                        Impressum
                    </RouterLink>
                    <span aria-hidden="true">·</span>
                    <RouterLink to="/datenschutz" class="transition-colors hover:text-foreground">
                        Datenschutz
                    </RouterLink>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref, watch } from 'vue';

import { CircleAlert, Info } from 'lucide-vue-next';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';

import { useAuth } from '@/composables/useAuth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

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
// the route (covers the router reusing this page instance, e.g. the push to
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
