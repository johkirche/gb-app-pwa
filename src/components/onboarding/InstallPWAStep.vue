<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <!-- Installed from this tab. The app is on the device now, but this page is
             still the browser, and nothing tells the reader so: Android leaves the
             tab as it was. So the step turns into the way across, led by the icon
             they are about to look for, drawn as a home screen draws it. -->
        <template v-if="isHandoff">
            <figure class="mx-auto mb-6 flex flex-col items-center gap-2">
                <img
                    :src="appIcon"
                    class="size-20 rounded-[1.25rem] shadow-sm ring-1 ring-border"
                    alt=""
                />
                <!-- The manifest's short_name, which is what the home screen
                     writes under the icon. -->
                <figcaption class="text-sm">Gesangbuch</figcaption>
            </figure>

            <h1 class="text-center font-display text-3xl font-semibold">Jetzt die App öffnen</h1>
            <p class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
                Das Gesangbuch ist installiert. Öffnen Sie es über dieses Symbol
                {{ whereTheIconIs }}.
                <!-- True only of the onboarding: the browser and the installed app
                     share their storage there, so the guard takes the app back into
                     it, and the app starts past this step. From Einstellungen it
                     opens on the songs. -->
                <template v-if="props.mode === 'onboarding'">
                    In der App geht es an dieser Stelle weiter.
                </template>
            </p>
            <!-- Chrome's own way across, two taps deep. The menu entry keeps its
                 install wording once the app is there; the sheet it opens is what
                 offers the app instead (Pixel 9, Chrome 157, 2026-11-13). Both
                 labels are Chromium's German (android_webapps_strings_de.xtb:
                 IDS_MENU_INSTALL_CREATE_SHORTCUT and the sheet's "This app is
                 already installed"). A Chrome set to another language shows its
                 own, which the three dots still lead to. Other browsers raise
                 `appinstalled` as well, hence „In Chrome".
                 A button cannot do this instead. Chrome keeps every link from
                 this host in the browser: plain, _blank, noreferrer, intent:// with
                 a fallback into the scope. Only an intent:// naming the app's
                 package opens it, and that name is minted per device: Krümel, with
                 the same manifest id on two phones, came out as two packages. -->
            <p
                v-if="isAndroidView"
                class="mt-4 text-center text-sm leading-relaxed text-muted-foreground"
            >
                In Chrome geht es auch über das Menü mit den drei Punkten: Tippen Sie dort auf
                „Installieren und Verknüpfung erstellen“ und dann auf „Diese App wurde bereits
                installiert“.
            </p>
        </template>

        <template v-else>
            <div
                class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10"
            >
                <Download class="size-10 text-primary" aria-hidden="true" />
            </div>

            <h1 class="text-center font-display text-3xl font-semibold">App installieren</h1>
            <p class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
                Als App haben Sie das Gesangbuch schnell zur Hand, auch ohne Internet.
            </p>
        </template>

        <!-- Definitely installed: running in standalone/PWA mode -->
        <div
            v-if="isStandalone"
            class="mt-8 flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-6"
        >
            <div class="flex items-center gap-2">
                <CircleCheck class="size-6 text-primary" aria-hidden="true" />
                <span class="font-medium">App ist bereits installiert</span>
            </div>
        </div>

        <!-- Loading: checking installation status -->
        <div
            v-else-if="isCheckingInstall && !isHandoff"
            class="mt-8 flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-4"
        >
            <Spinner size="sm" />
            <span class="font-medium text-muted-foreground">
                Wir prüfen, ob die App schon installiert ist...
            </span>
        </div>

        <template v-else-if="!isHandoff">
            <!-- Heuristic: we suspect the app might be installed. Only a guess, since a
                 browser that never offers the install prompt ends up here as well, so
                 the box says what to do if it is wrong and the steps stay below it. -->
            <div
                v-if="isSuspectedInstalled"
                class="mt-8 flex items-start gap-3 rounded-lg border-l-4 border-flourish bg-flourish/10 px-4 py-3"
            >
                <Info class="mt-0.5 size-5 shrink-0 text-flourish" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium">Die App scheint bereits installiert zu sein</p>
                    <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Sie finden sie bei den Apps auf Ihrem Gerät. Falls nicht, installieren Sie
                        sie mit den Schritten unten.
                    </p>
                </div>
            </div>

            <!-- Install Action (Android/Desktop only, if prompt is available) -->
            <div v-if="showInstallAction" :class="isSuspectedInstalled ? 'mt-6' : 'mt-8'">
                <Button type="button" size="lg" class="w-full" @click="installPWA">
                    <Download aria-hidden="true" />
                    {{ installButtonLabel }}
                </Button>
            </div>

            <div v-if="!isSuspectedInstalled" :class="showInstallAction ? 'mt-6' : 'mt-8'">
                <div
                    v-if="showInstallAction"
                    class="mb-2 flex items-center gap-3 text-sm text-muted-foreground"
                >
                    <Separator class="flex-1" />
                    <span>oder</span>
                    <Separator class="flex-1" />
                </div>
                <p class="text-center text-sm text-muted-foreground">
                    So installieren Sie die App über den Browser:
                </p>
            </div>

            <!-- The icons float: in a column of their own they left too little room at
                 Größe 200 % for „Installations-“, and this way the lines below an icon
                 take the whole width. Decorative, since each row names what it shows. -->

            <!-- iOS Instructions -->
            <div v-if="isIOSView" class="mt-4">
                <div class="divide-y divide-border rounded-lg border border-border px-4">
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">1</span>
                        <p class="flow-root min-w-0 text-[0.9375rem] leading-relaxed">
                            <Share
                                class="float-right ml-4 size-6 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Tippen Sie auf das
                            <strong>Teilen-Symbol</strong>
                        </p>
                    </div>
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">2</span>
                        <p class="flow-root min-w-0 text-[0.9375rem] leading-relaxed">
                            <Plus
                                class="float-right ml-4 size-6 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Scrollen Sie nach unten und tippen Sie auf
                            <strong>„Zum Home-Bildschirm“</strong>
                        </p>
                    </div>
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">3</span>
                        <p class="min-w-0 text-[0.9375rem] leading-relaxed">
                            Tippen Sie auf
                            <strong>„Hinzufügen“</strong>
                        </p>
                    </div>
                    <!-- Safari says nothing to the page about the new icon, so the
                         step that elsewhere follows an installation is written out
                         as one more instruction. -->
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">4</span>
                        <p class="flow-root min-w-0 text-[0.9375rem] leading-relaxed">
                            <img
                                :src="appIcon"
                                class="float-right ml-4 size-6 rounded-[0.375rem] ring-1 ring-border"
                                alt=""
                            />
                            Öffnen Sie das Gesangbuch über das neue Symbol auf dem
                            <strong>Home-Bildschirm</strong>
                        </p>
                    </div>
                </div>
                <!-- A home-screen app on iOS keeps its own storage, and the session
                     here is a token in IndexedDB rather than a cookie, so even the
                     login Safari copies across since 17.2 does not come with it.
                     Said here so it is no surprise, and so nobody downloads the
                     whole book into the browser first. -->
                <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Die App teilt keine Daten mit dem Browser. Darum melden Sie sich in der App noch
                    einmal an, und das Gesangbuch wird dort neu geladen.
                </p>
            </div>

            <!-- Android Instructions -->
            <div v-else-if="isAndroidView" class="mt-4">
                <div class="divide-y divide-border rounded-lg border border-border px-4">
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">1</span>
                        <p class="flow-root min-w-0 text-[0.9375rem] leading-relaxed">
                            <EllipsisVertical
                                class="float-right ml-4 size-6 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Tippen Sie auf das
                            <strong>Menü-Symbol</strong>
                            (drei Punkte)
                        </p>
                    </div>
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">2</span>
                        <p class="flow-root min-w-0 text-[0.9375rem] leading-relaxed">
                            <Download
                                class="float-right ml-4 size-6 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Wählen Sie
                            <strong>„App installieren“</strong>
                            oder
                            <strong>„Zum Startbildschirm hinzufügen“</strong>
                        </p>
                    </div>
                </div>
            </div>

            <!-- Desktop Instructions -->
            <div v-else class="mt-4">
                <div class="divide-y divide-border rounded-lg border border-border px-4">
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">1</span>
                        <p class="flow-root min-w-0 text-[0.9375rem] leading-relaxed">
                            <img
                                :src="desktopInstallIcon"
                                class="float-right ml-4 size-6 dark:invert-[.85]"
                                alt=""
                            />
                            Klicken Sie auf das
                            <strong>Installations-Symbol</strong>
                            in der Adressleiste
                        </p>
                    </div>
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">2</span>
                        <p class="min-w-0 text-[0.9375rem] leading-relaxed">
                            Bestätigen Sie mit
                            <strong>„Installieren“</strong>
                        </p>
                    </div>
                </div>
            </div>
        </template>

        <!-- Dev-only: preview instructions for other device types -->
        <div v-if="isDev" class="fixed bottom-4 right-4 z-50">
            <Button
                type="button"
                size="sm"
                variant="outline"
                class="text-muted-foreground"
                @click="cyclePreviewDevice"
            >
                Vorschau: {{ previewDeviceLabel }}
            </Button>
        </div>

        <div class="mt-auto flex flex-col gap-2 pt-8">
            <!-- When the reader's next move is outside this tab, a „Weiter" here
                 would lead them on in the browser instead, which is exactly the
                 mistake. The way to stay is still offered, but quietly, and it
                 says where it goes. The long labels here may wrap: at Größe
                 200 % they are wider than a phone. -->
            <Button
                v-if="props.mode === 'onboarding' && nextIsElsewhere"
                type="button"
                variant="outline"
                size="lg"
                class="h-auto min-h-12 w-full whitespace-normal py-3"
                @click="$emit('next')"
            >
                Im Browser weitermachen
            </Button>
            <template v-else-if="props.mode === 'onboarding'">
                <Button
                    type="button"
                    size="lg"
                    class="w-full"
                    :disabled="!canProceed"
                    @click="$emit('next')"
                >
                    Weiter
                    <ArrowRight aria-hidden="true" />
                </Button>
                <!-- Only while the step is still waiting on an installation it
                     can actually detect. Once the primary action is open, a
                     second button doing exactly the same thing is noise. -->
                <Button
                    v-if="!canProceed"
                    type="button"
                    variant="outline"
                    size="lg"
                    class="h-auto min-h-12 w-full whitespace-normal py-3"
                    @click="$emit('next')"
                >
                    Ohne Installation fortfahren
                </Button>
            </template>
            <Button
                v-if="props.mode === 'standalone'"
                type="button"
                size="lg"
                class="w-full"
                @click="$emit('done')"
            >
                Fertig
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
    ArrowRight,
    CircleCheck,
    Download,
    EllipsisVertical,
    Info,
    Plus,
    Share,
} from 'lucide-vue-next';

import desktopInstallIcon from '@/assets/pwa-icons/pwa-desktop-install.png';

import { usePWA } from '@/composables/usePWA';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

// Props
const props = withDefaults(
    defineProps<{
        mode?: 'onboarding' | 'standalone';
    }>(),
    {
        mode: 'onboarding',
    },
);

// Emits
defineEmits<{
    next: [];
    skip: [];
    done: [];
}>();

// Use the PWA composable (listeners are initialized in main.ts)
const {
    isIOS,
    isAndroid,
    isStandalone,
    canInstall,
    installPWA,
    isSuspectedInstalled,
    isCheckingInstall,
    wasInstalled,
} = usePWA();

const isDev = import.meta.env.DEV;
const previewDevice = ref<'auto' | 'ios' | 'android' | 'desktop'>('auto');

const isIOSView = computed(() =>
    previewDevice.value === 'auto' ? isIOS.value : previewDevice.value === 'ios',
);
const isAndroidView = computed(() =>
    previewDevice.value === 'auto' ? isAndroid.value : previewDevice.value === 'android',
);
const showInstallAction = computed(() => canInstall.value && !isIOSView.value);
const installButtonLabel = computed(() =>
    isAndroidView.value ? 'Jetzt installieren' : 'App installieren',
);

// The tile the home screen shows, which is what the reader is about to look
// for, not the bare emblem. The touch icon is drawn on a full background with
// little margin: closer to an Android launcher, which crops the maskable
// icon's safe zone away, than the maskable icon itself.
const appIcon = `${import.meta.env.BASE_URL}apple-touch-icon.png`;

// Installed from this tab, and still in it. A desktop Chrome moves the tab
// into the app's own window, the display mode changes and `isStandalone`
// takes over; Android leaves it where it was, which is the case this is for.
const isHandoff = computed(() => wasInstalled.value && !isStandalone.value);

// Safari never fires `beforeinstallprompt` and tells a page in a tab nothing
// about a home-screen icon, so on iOS the steps themselves end on the home
// screen. There, as after an installation, what comes next is not in this tab.
const nextIsElsewhere = computed(() => !isStandalone.value && (isHandoff.value || isIOSView.value));

const whereTheIconIs = computed(() => {
    if (isIOSView.value) return 'auf Ihrem Home-Bildschirm';
    if (isAndroidView.value) return 'auf Ihrem Startbildschirm';
    return 'bei Ihren Programmen';
});

const canProceed = computed(
    () => isStandalone.value || isSuspectedInstalled.value || wasInstalled.value,
);

const previewDeviceLabel = computed(() => {
    switch (previewDevice.value) {
        case 'ios':
            return 'iOS';
        case 'android':
            return 'Android';
        case 'desktop':
            return 'Desktop';
        default:
            return 'Auto';
    }
});

function cyclePreviewDevice() {
    const order: Array<typeof previewDevice.value> = ['auto', 'ios', 'android', 'desktop'];
    const currentIndex = order.indexOf(previewDevice.value);
    previewDevice.value = order[(currentIndex + 1) % order.length];
}
</script>

<style scoped>
.instruction-number {
    display: flex;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: var(--primary);
    color: var(--primary-foreground);
    font-size: 0.875rem;
    font-weight: 600;
}
</style>
