<template>
    <!-- Every way in, one step at a time: the address, the code from the mail,
         then whatever that turns up. An address without an account asks for the
         Aktivierungscode, an account on four devices for one to sign out. The
         password is the side way, and a device whose session ended greets its
         reader back. Whether an address has an account is only told to whoever
         has the code from its mailbox. -->
    <div class="flex h-full flex-col bg-background">
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
            >
                <div class="flex min-h-12 items-center">
                    <Button
                        v-if="backTarget"
                        variant="ghost"
                        size="sm"
                        class="-ml-3 h-auto min-h-10 whitespace-normal"
                        :disabled="busy"
                        @click="back"
                    >
                        <ChevronLeft aria-hidden="true" />
                        Zurück
                    </Button>
                </div>

                <FormNotice
                    v-if="reasonMessage"
                    class="mb-6"
                    :message="reasonMessage"
                    tone="info"
                />

                <!-- The address -->
                <form
                    v-if="step === 'email'"
                    class="flex flex-1 flex-col"
                    novalidate
                    @submit.prevent="sendCode(email)"
                >
                    <h1 class="font-display text-3xl font-semibold">Anmelden</h1>
                    <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        oder ein neues Konto anlegen. Beides beginnt hier.
                    </p>

                    <div class="mt-8 space-y-2">
                        <Label for="signin-email">E-Mail-Adresse</Label>
                        <Input
                            id="signin-email"
                            v-model="email"
                            type="email"
                            name="email"
                            autocomplete="email"
                            inputmode="email"
                            :disabled="busy"
                        />
                    </div>
                    <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Wir schicken Ihnen einen sechsstelligen Code. Ein Passwort brauchen Sie
                        dafür nicht.
                    </p>
                    <FormNotice class="mt-5" :message="error" />

                    <div class="mt-auto flex flex-col gap-2 pt-8">
                        <p class="mb-2 text-sm leading-relaxed text-muted-foreground">
                            Neu hier? Dann fragen wir nach dem Code noch nach Ihrem Aktivierungscode
                            von der Rückseite Ihres Lesezeichens.
                        </p>
                        <Button
                            type="submit"
                            size="lg"
                            class="w-full"
                            :disabled="busy || !emailValid"
                        >
                            <Spinner v-if="busy" size="sm" class="text-primary-foreground" />
                            <span v-else>Code senden</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            class="w-full h-auto min-h-10 whitespace-normal"
                            :disabled="busy"
                            @click="openPassword('email')"
                        >
                            Mit Passwort anmelden
                        </Button>
                        <component :is="DevSkipButton" v-if="DevSkipButton" :disabled="busy" />
                    </div>
                </form>

                <!-- The code from the mail -->
                <form
                    v-else-if="step === 'code'"
                    class="flex flex-1 flex-col"
                    novalidate
                    @submit.prevent="checkTheCode(code)"
                >
                    <h1 class="font-display text-3xl font-semibold">Code eingeben</h1>
                    <!-- overflow-wrap:anywhere, not break-all: the address moves to a line
                         of its own whole, and is cut only where it cannot fit on one. -->
                    <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        Wir haben einen Code an
                        <strong class="font-medium text-foreground [overflow-wrap:anywhere]">
                            {{ email }}
                        </strong>
                        geschickt. Er gilt 15&nbsp;Minuten.
                    </p>

                    <CodeInput
                        id="signin-code"
                        v-model="code"
                        class="mt-8"
                        :state="codeState"
                        :disabled="busy || codeSpent"
                        @complete="checkTheCode"
                    />
                    <FormNotice class="mt-5" :message="error" />
                    <FormNotice class="mt-5" :message="notice" tone="info" />
                    <p class="mt-5 text-sm leading-relaxed text-muted-foreground">
                        Keine Mail da? Sehen Sie auch im Spam-Ordner nach.
                    </p>

                    <div class="mt-auto flex flex-col gap-2 pt-8">
                        <Button
                            type="submit"
                            size="lg"
                            class="w-full"
                            :disabled="busy || codeSpent || code.length !== 6"
                        >
                            <Spinner v-if="busy" size="sm" class="text-primary-foreground" />
                            <span v-else>Bestätigen</span>
                        </Button>
                        <div class="flex flex-wrap justify-center gap-x-2">
                            <Button
                                type="button"
                                variant="ghost"
                                class="h-auto min-h-10 whitespace-normal"
                                :disabled="busy || resendIn > 0"
                                @click="resend"
                            >
                                {{ resendLabel }}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                class="h-auto min-h-10 whitespace-normal"
                                :disabled="busy"
                                @click="otherAddress"
                            >
                                Andere Adresse
                            </Button>
                        </div>
                    </div>
                </form>

                <!-- A new account: the Aktivierungscode -->
                <form
                    v-else-if="step === 'aktivierung'"
                    class="flex flex-1 flex-col"
                    novalidate
                    @submit.prevent="register"
                >
                    <h1 class="font-display text-3xl font-semibold">Willkommen!</h1>
                    <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        Zu
                        <strong class="font-medium text-foreground [overflow-wrap:anywhere]">
                            {{ email }}
                        </strong>
                        gibt es noch kein Konto. Mit Ihrem Aktivierungscode legen wir es jetzt an.
                    </p>

                    <div class="mt-8 space-y-2">
                        <Label for="signin-activation">Aktivierungscode</Label>
                        <Input
                            id="signin-activation"
                            v-model="activationCode"
                            name="activation-code"
                            autocomplete="off"
                            autocapitalize="none"
                            spellcheck="false"
                            :disabled="busy"
                        />
                    </div>
                    <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Er steht auf dem Aufkleber auf der Rückseite Ihres Gesangbuch-Lesezeichens.
                        Jeder Code gilt für ein Konto.
                    </p>
                    <FormNotice class="mt-5" :message="error" />

                    <div class="mt-auto flex flex-col gap-2 pt-8">
                        <Button
                            type="submit"
                            size="lg"
                            class="w-full"
                            :disabled="busy || !activationCode.trim()"
                        >
                            <Spinner v-if="busy" size="sm" class="text-primary-foreground" />
                            <span v-else>Konto anlegen</span>
                        </Button>
                        <p class="text-center text-xs text-muted-foreground">
                            <RouterLink to="/datenschutz" class="underline underline-offset-2">
                                Es gelten die Datenschutzhinweise.
                            </RouterLink>
                        </p>
                    </div>
                </form>

                <!-- The account is on as many devices as it may be -->
                <form
                    v-else-if="step === 'geraete' && swap"
                    class="flex flex-1 flex-col"
                    novalidate
                    @submit.prevent="swapOut"
                >
                    <h1 class="font-display text-3xl font-semibold">
                        Schon auf {{ numberWord(swap.limit) }} Geräten angemeldet
                    </h1>
                    <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        Ein Konto gilt für bis zu {{ numberWord(swap.limit) }} Geräte. Melden Sie
                        eines ab, um auf diesem weiterzumachen.
                    </p>

                    <!-- min-w-0: a fieldset is as wide as its content by default. -->
                    <fieldset class="mt-6 min-w-0">
                        <legend class="sr-only">Gerät zum Abmelden</legend>
                        <div class="divide-y divide-border rounded-lg border border-border">
                            <label
                                v-for="device in swap.devices"
                                :key="device.id"
                                class="flex cursor-pointer items-center gap-3 px-4 py-3"
                            >
                                <input
                                    v-model="signOutId"
                                    type="radio"
                                    name="device"
                                    class="size-4 shrink-0 accent-primary"
                                    :value="device.id"
                                    :disabled="busy"
                                />
                                <component
                                    :is="deviceIcon(device.name)"
                                    class="size-6 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <span class="min-w-0">
                                    <span class="block font-medium [overflow-wrap:anywhere]">
                                        {{ device.name }}
                                    </span>
                                    <span class="block text-sm text-muted-foreground">
                                        zuletzt {{ lastSeen(device.last_seen) }}
                                    </span>
                                </span>
                            </label>
                        </div>
                    </fieldset>
                    <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Das abgemeldete Gerät behält seine Lieder, fragt beim nächsten Öffnen aber
                        nach einem Code.
                    </p>
                    <FormNotice class="mt-5" :message="error" />

                    <div class="mt-auto flex flex-col gap-2 pt-8">
                        <Button
                            type="submit"
                            size="lg"
                            class="h-auto min-h-12 w-full whitespace-normal py-3"
                            :disabled="busy || signOutId === null"
                        >
                            <Spinner v-if="busy" size="sm" class="text-primary-foreground" />
                            <span v-else>Abmelden und hier weiter</span>
                        </Button>
                        <Button type="button" variant="ghost" :disabled="busy" @click="go('email')">
                            Abbrechen
                        </Button>
                    </div>
                </form>

                <!-- Back after the session ended -->
                <form
                    v-else-if="step === 'wieder' && returning"
                    class="flex flex-1 flex-col"
                    novalidate
                    @submit.prevent="sendCode(returning.email, 'wieder')"
                >
                    <h1 class="font-display text-3xl font-semibold">
                        Willkommen zurück{{ returning.firstName ? `, ${returning.firstName}` : '' }}
                    </h1>
                    <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        Dieses Gerät war eine Weile nicht mit Ihrem Konto verbunden. Bestätigen Sie
                        kurz mit einem Code, dass Sie es sind, dann geht es weiter.
                    </p>
                    <div class="mt-8 space-y-2">
                        <p class="text-sm font-medium">E-Mail-Adresse</p>
                        <p
                            class="rounded-lg bg-muted px-3 py-2 text-[0.9375rem] [overflow-wrap:anywhere]"
                        >
                            {{ returning.email }}
                        </p>
                    </div>
                    <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Ihre Lieder, Playlisten und Markierungen sind noch auf dem Gerät.
                    </p>
                    <FormNotice class="mt-5" :message="error" />

                    <div class="mt-auto flex flex-col gap-2 pt-8">
                        <Button type="submit" size="lg" class="w-full" :disabled="busy">
                            <Spinner v-if="busy" size="sm" class="text-primary-foreground" />
                            <span v-else>Code senden</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            class="w-full h-auto min-h-10 whitespace-normal"
                            :disabled="busy"
                            @click="openPassword('wieder')"
                        >
                            Mit Passwort anmelden
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            class="h-auto min-h-10 w-full whitespace-normal"
                            :disabled="busy"
                            @click="anotherAccount"
                        >
                            Mit einer anderen Adresse anmelden
                        </Button>
                    </div>
                </form>

                <!-- The side way: the password -->
                <form
                    v-else-if="step === 'passwort'"
                    class="flex flex-1 flex-col"
                    novalidate
                    @submit.prevent="signInWithPassword"
                >
                    <h1 class="font-display text-3xl font-semibold">Mit Passwort anmelden</h1>
                    <div class="mt-8 space-y-5">
                        <div class="space-y-2">
                            <Label for="signin-password-email">E-Mail-Adresse</Label>
                            <Input
                                id="signin-password-email"
                                v-model="email"
                                type="email"
                                name="email"
                                autocomplete="username"
                                inputmode="email"
                                :disabled="busy"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="signin-password">Passwort</Label>
                            <Input
                                id="signin-password"
                                v-model="password"
                                type="password"
                                name="password"
                                autocomplete="current-password"
                                :disabled="busy"
                            />
                        </div>
                    </div>
                    <FormNotice class="mt-5" :message="error" />
                    <p class="mt-5 text-sm leading-relaxed text-muted-foreground">
                        Passwort vergessen? Melden Sie sich mit einem Code an und legen Sie danach
                        in den Einstellungen unter „Konto“ ein neues fest.
                    </p>

                    <div class="mt-auto flex flex-col gap-2 pt-8">
                        <Button
                            type="submit"
                            size="lg"
                            class="w-full"
                            :disabled="busy || !emailValid || !password"
                        >
                            <Spinner v-if="busy" size="sm" class="text-primary-foreground" />
                            <span v-else>Anmelden</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            class="w-full h-auto min-h-10 whitespace-normal"
                            :disabled="busy || !emailValid"
                            @click="sendCode(email, 'passwort')"
                        >
                            Stattdessen Code senden
                        </Button>
                    </div>
                </form>

                <!-- In -->
                <section v-else-if="step === 'fertig'" class="flex flex-1 flex-col">
                    <div
                        class="flex size-14 items-center justify-center rounded-full bg-primary/10"
                        aria-hidden="true"
                    >
                        <Check class="size-7 text-primary" />
                    </div>
                    <h1 class="mt-6 font-display text-3xl font-semibold">{{ done.title }}</h1>
                    <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        {{ done.text }}
                    </p>
                    <ul v-if="done.next.length" class="mt-5 space-y-2">
                        <li
                            v-for="item in done.next"
                            :key="item"
                            class="flex items-start gap-3 text-[0.9375rem]"
                        >
                            <ArrowRight
                                class="mt-1 size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <span class="min-w-0">{{ item }}</span>
                        </li>
                    </ul>
                    <div class="mt-auto pt-8">
                        <Button size="lg" class="w-full" @click="router.replace(done.to)">
                            {{ done.button }}
                        </Button>
                    </div>
                </section>

                <!-- Whoever cannot get in must still reach these. -->
                <nav
                    v-if="step !== 'fertig'"
                    class="mt-8 flex items-center justify-center gap-3 text-xs text-muted-foreground"
                    aria-label="Rechtliches"
                >
                    <RouterLink to="/impressum" class="transition-colors hover:text-foreground">
                        Impressum
                    </RouterLink>
                    <span aria-hidden="true">·</span>
                    <RouterLink to="/datenschutz" class="transition-colors hover:text-foreground">
                        Datenschutz
                    </RouterLink>
                </nav>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';

import { ArrowRight, Check, ChevronLeft, Monitor, Smartphone, Tablet } from 'lucide-vue-next';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';
import { useUserStore } from '@/stores/user';

import { useAuth } from '@/composables/useAuth';
import { isRunningStandalone } from '@/composables/usePWA';

import CodeInput from '@/components/einstieg/CodeInput.vue';
import FormNotice from '@/components/einstieg/FormNotice.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import {
    type DeviceLimit,
    EinstiegError,
    type Session,
    checkCode,
    describeEinstiegError,
    deviceLimitOf,
    registerWithTicket,
    requestCode,
    swapDevice,
} from '@/api/einstieg.api';
import { LOGOUT_REASON_MESSAGES, type LogoutReason } from '@/services/errorHandler';
import { type LastAccount, readLastAccount } from '@/services/lastAccount';

type Step =
    | 'laden'
    | 'email'
    | 'code'
    | 'aktivierung'
    | 'geraete'
    | 'wieder'
    | 'passwort'
    | 'fertig';
type Outcome = 'neu' | 'konto' | 'getauscht' | 'zurueck';

const router = useRouter();
const route = useRoute();
const songsStore = useSongsStore();
const userStore = useUserStore();
const { login, startSession } = useAuth();

// Dev-only skip button, loaded via a DEV-guarded dynamic import so production
// builds emit neither the chunk nor its strings.
const DevSkipButton =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_SKIP === 'true'
        ? defineAsyncComponent(() => import('@/components/dev/DevSkipButton.vue'))
        : null;

// A device whose session ended keeps its reader's book, and greets them back.
// Only then: after a logout on purpose, or on a fresh device, nobody is known.
// Decided once the songs have been read from the device: opened cold at this
// address, the page is up before they are.
const returning = ref<LastAccount | null>(null);

const step = ref<Step>('laden');
const email = ref('');

void Promise.all([songsStore.initPromise, userStore.initPromise]).then(() => {
    const last = readLastAccount();
    if (songsStore.hasSongs && !userStore.isLoggedIn && last) {
        returning.value = last;
        email.value = last.email;
        step.value = 'wieder';
    } else {
        step.value = 'email';
    }
});
const code = ref('');
const activationCode = ref('');
const password = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const codeState = ref<'idle' | 'wrong' | 'right'>('idle');
// No tries left on this code: only a new one helps.
const codeSpent = ref(false);
// Where the code step and the password step go back to.
const codeFrom = ref<Step>('email');
const passwordFrom = ref<Step>('email');

let ticket: string | null = null;
const swap = ref<DeviceLimit | null>(null);
const signOutId = ref<number | null>(null);
const signedOutName = ref<string | null>(null);
const outcome = ref<Outcome>('konto');

const reasonMessage = ref<string | null>(null);
{
    const reason = route.query.reason;
    if (typeof reason === 'string') {
        const message = LOGOUT_REASON_MESSAGES[reason as LogoutReason];
        if (typeof message === 'string' && reason !== 'session_expired')
            reasonMessage.value = message;
    }
}

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));

function go(next: Step) {
    error.value = null;
    notice.value = null;
    step.value = next;
}

// ---- Back ----

const backTarget = computed<Step | 'away' | null>(() => {
    switch (step.value) {
        case 'email':
            if (returning.value) return 'wieder';
            // The installed app starts here; in the browser the start page or
            // the install page came before.
            return isRunningStandalone() ? null : 'away';
        case 'code':
            return codeFrom.value;
        case 'passwort':
            return passwordFrom.value;
        case 'aktivierung':
        case 'geraete':
            return 'email';
        default:
            return null;
    }
});

function back() {
    const target = backTarget.value;
    if (!target) return;
    if (target === 'away') {
        if (window.history.state?.back) router.back();
        else router.replace('/willkommen');
        return;
    }
    go(target);
}

// ---- The code ----

const resendIn = ref(0);
let resendTimer: ReturnType<typeof setInterval> | null = null;

function startResendCountdown(seconds: number) {
    resendIn.value = seconds;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        resendIn.value = Math.max(0, resendIn.value - 1);
        if (resendIn.value === 0 && resendTimer) {
            clearInterval(resendTimer);
            resendTimer = null;
        }
    }, 1000);
}

onBeforeUnmount(() => {
    if (resendTimer) clearInterval(resendTimer);
});

const resendLabel = computed(() => {
    if (resendIn.value <= 0) return 'Erneut senden';
    const m = Math.floor(resendIn.value / 60);
    const s = String(resendIn.value % 60).padStart(2, '0');
    return `Erneut senden (${m}:${s})`;
});

function resetCode() {
    code.value = '';
    codeState.value = 'idle';
    codeSpent.value = false;
}

async function sendCode(address: string, from: Step = 'email') {
    if (busy.value) return;
    email.value = address.trim();
    if (!emailValid.value) {
        error.value = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
        return;
    }
    busy.value = true;
    error.value = null;
    try {
        const { resendIn: wait } = await requestCode(email.value);
        codeFrom.value = from;
        resetCode();
        go('code');
        startResendCountdown(wait);
    } catch (err) {
        // A code went out moments ago (the reader came back to change
        // something): that one still works, so on to entering it.
        if (
            err instanceof EinstiegError &&
            err.code === 'CODE_REQUESTED_TOO_OFTEN' &&
            (err.retryAfter ?? 0) <= 30
        ) {
            codeFrom.value = from;
            resetCode();
            go('code');
            startResendCountdown(err.retryAfter ?? 30);
            notice.value = 'Es ist schon ein Code unterwegs. Er gilt 15 Minuten.';
            return;
        }
        error.value = describeEinstiegError(err);
    } finally {
        busy.value = false;
    }
}

async function resend() {
    if (busy.value || resendIn.value > 0) return;
    busy.value = true;
    error.value = null;
    notice.value = null;
    try {
        const { resendIn: wait } = await requestCode(email.value);
        resetCode();
        startResendCountdown(wait);
        notice.value = 'Ein neuer Code ist unterwegs. Der alte gilt nicht mehr.';
    } catch (err) {
        error.value = describeEinstiegError(err);
        if (err instanceof EinstiegError && err.retryAfter) startResendCountdown(err.retryAfter);
    } finally {
        busy.value = false;
    }
}

function otherAddress() {
    resetCode();
    go('email');
}

async function checkTheCode(typed: string) {
    if (busy.value || typed.length !== 6) return;
    busy.value = true;
    error.value = null;
    notice.value = null;
    try {
        const result = await checkCode(email.value, typed);
        codeState.value = 'right';
        if (result.result === 'needs_registration') {
            ticket = result.ticket;
            activationCode.value = '';
            go('aktivierung');
            return;
        }
        await finish(
            result.session,
            returning.value && codeFrom.value === 'wieder' ? 'zurueck' : 'konto',
        );
    } catch (err) {
        const limit = deviceLimitOf(err);
        if (limit) {
            offerSwap(limit);
            return;
        }
        codeState.value = 'wrong';
        error.value = describeEinstiegError(err);
        if (err instanceof EinstiegError) {
            if (
                err.code === 'CODE_EXPIRED' ||
                (err.code === 'CODE_INVALID' && err.attemptsLeft === 0)
            ) {
                codeSpent.value = true;
                resendIn.value = 0;
            }
        }
        // Clear the boxes for the next try once the shake is over.
        setTimeout(() => {
            if (!codeSpent.value) code.value = '';
            if (codeState.value === 'wrong') codeState.value = 'idle';
        }, 700);
    } finally {
        busy.value = false;
    }
}

// ---- A new account ----

async function register() {
    if (busy.value || !ticket) return;
    busy.value = true;
    error.value = null;
    try {
        const session = await registerWithTicket(ticket, activationCode.value.trim());
        await finish(session, 'neu');
    } catch (err) {
        error.value = describeEinstiegError(err);
        if (err instanceof EinstiegError) {
            const startOver =
                err.code === 'TICKET_INVALID' ||
                (err.code === 'REGISTRATION_CODE_INVALID' && err.attemptsLeft === 0);
            if (startOver) {
                // The proven address is spent: back to the beginning, with
                // the reason kept in view.
                const message = error.value;
                ticket = null;
                resetCode();
                go('email');
                error.value = message;
            } else if (err.code === 'USER_ALREADY_REGISTERED') {
                const message = error.value;
                go('email');
                error.value = message;
            }
        }
    } finally {
        busy.value = false;
    }
}

// ---- Devices ----

function offerSwap(limit: DeviceLimit) {
    swap.value = limit;
    // The one longest out of use is the likeliest to go.
    const oldest = [...limit.devices].sort(
        (a, b) => new Date(a.last_seen).getTime() - new Date(b.last_seen).getTime(),
    )[0];
    signOutId.value = oldest?.id ?? null;
    go('geraete');
}

async function swapOut() {
    if (busy.value || !swap.value || signOutId.value === null) return;
    busy.value = true;
    error.value = null;
    try {
        signedOutName.value =
            swap.value.devices.find((d) => d.id === signOutId.value)?.name ?? null;
        const session = await swapDevice(swap.value.ticket, signOutId.value);
        await finish(session, 'getauscht');
    } catch (err) {
        const limit = deviceLimitOf(err);
        if (limit) {
            offerSwap(limit);
            error.value = 'Das hat nicht geklappt. Bitte wählen Sie noch einmal.';
            return;
        }
        error.value = describeEinstiegError(err);
        if (err instanceof EinstiegError && err.code === 'TICKET_INVALID') {
            const message = error.value;
            go('email');
            error.value = message;
        }
    } finally {
        busy.value = false;
    }
}

function deviceIcon(name: string) {
    if (/iPad|Tablet/.test(name)) return Tablet;
    if (/iPhone|Handy/.test(name)) return Smartphone;
    return Monitor;
}

function lastSeen(iso: string): string {
    const then = new Date(iso);
    const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
    if (days <= 0) return 'heute';
    if (days === 1) return 'gestern';
    if (days < 14) return `vor ${days} Tagen`;
    if (days < 60) return `vor ${Math.floor(days / 7)} Wochen`;
    return `am ${then.toLocaleDateString('de-DE')}`;
}

function numberWord(n: number): string {
    return ['null', 'einem', 'zwei', 'drei', 'vier', 'fünf', 'sechs'][n] ?? String(n);
}

// ---- The password ----

function openPassword(from: Step) {
    passwordFrom.value = from;
    password.value = '';
    go('passwort');
}

async function signInWithPassword() {
    if (busy.value || !emailValid.value || !password.value) return;
    busy.value = true;
    error.value = null;
    try {
        const result = await login(email.value.trim(), password.value);
        if (result.success) {
            const back = returning.value && result.user.id === returning.value.id;
            showDone(back ? 'zurueck' : 'konto');
            return;
        }
        if (result.deviceLimit) {
            offerSwap(result.deviceLimit);
            return;
        }
        error.value = result.error;
    } finally {
        busy.value = false;
    }
}

function anotherAccount() {
    email.value = '';
    go('email');
}

// ---- In ----

async function finish(session: Session, how: Outcome) {
    // The address just proven, in case the profile does not say it.
    const user = await startSession(session, email.value.trim());
    // Somebody other than the reader whose book this was: not a return.
    const back =
        how === 'zurueck' && returning.value && user.id !== returning.value.id ? 'konto' : how;
    showDone(back);
}

function showDone(how: Outcome) {
    outcome.value = how;
    go('fertig');
}

const done = computed(() => {
    const name = userStore.user?.firstName;
    const hasSongs = songsStore.hasSongs;
    const load = {
        next: ['Lieder laden', 'Playlisten und Markierungen kommen vom Konto mit'],
        button: 'Lieder laden',
        to: '/onboarding',
    };
    const read = { next: [] as string[], button: 'Zum Gesangbuch', to: '/tabs/lieder' };
    switch (outcome.value) {
        case 'neu':
            return {
                title: 'Konto angelegt',
                text: `Willkommen${name ? `, ${name}` : ''}! Jetzt geht es weiter:`,
                next: ['Gemeinde wählen', 'Lieder auf das Gerät laden', 'Kurze Tour durch die App'],
                button: 'Weiter',
                to: '/onboarding',
            };
        case 'zurueck':
            return {
                title: 'Willkommen zurück',
                text: 'Ihre Lieder waren die ganze Zeit da. Was sich seitdem geändert hat, holt die App jetzt nach.',
                ...read,
            };
        case 'getauscht': {
            const gone = signedOutName.value ? `${signedOutName.value} ist abgemeldet. ` : '';
            return hasSongs
                ? {
                      title: 'Angemeldet',
                      text: `${gone}Die Lieder sind schon auf diesem Gerät.`,
                      ...read,
                  }
                : {
                      title: 'Angemeldet',
                      text: `${gone}Als Nächstes kommen die Lieder auf dieses Gerät.`,
                      ...load,
                  };
        }
        default:
            return hasSongs
                ? { title: 'Angemeldet', text: 'Die Lieder sind schon auf diesem Gerät.', ...read }
                : {
                      title: 'Angemeldet',
                      text: 'Als Nächstes kommen die Lieder auf dieses Gerät.',
                      ...load,
                  };
    }
});

onMounted(() => {
    // The reason has been read; a reload should not show it again.
    if (route.query.reason) router.replace({ path: route.path, query: {} });
});
</script>
