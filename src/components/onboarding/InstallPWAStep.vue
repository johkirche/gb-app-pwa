<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <div
            class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10"
        >
            <Download class="size-10 text-primary" aria-hidden="true" />
        </div>

        <h1 class="text-center font-display text-3xl font-semibold">App installieren</h1>
        <p class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
            Installieren Sie das Gesangbuch als App auf Ihrem Gerät für schnellen Zugriff und
            Offline-Nutzung.
        </p>

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
            v-else-if="isCheckingInstall"
            class="mt-8 flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-4"
        >
            <Spinner size="sm" />
            <span class="font-medium text-muted-foreground">
                Installationsstatus wird geprüft...
            </span>
        </div>

        <template v-else>
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
                    Manuelle Installation über den Browser:
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
                            <strong>"Zum Home-Bildschirm"</strong>
                        </p>
                    </div>
                    <div class="grid grid-cols-[1.75rem_1fr] items-start gap-x-4 py-4">
                        <span class="instruction-number">3</span>
                        <p class="min-w-0 text-[0.9375rem] leading-relaxed">
                            Tippen Sie auf
                            <strong>"Hinzufügen"</strong>
                        </p>
                    </div>
                </div>
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
                            <strong>"App installieren"</strong>
                            oder
                            <strong>"Zum Startbildschirm hinzufügen"</strong>
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
                            <strong>"Installieren"</strong>
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
            <Button
                v-if="props.mode === 'onboarding'"
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
                 second button doing exactly the same thing is noise — and
                 it is what readers on iOS were left pressing. -->
            <Button
                v-if="props.mode === 'onboarding' && !canProceed"
                type="button"
                variant="outline"
                size="lg"
                class="w-full"
                @click="$emit('next')"
            >
                Ohne Installation fortfahren
            </Button>
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

// Safari never fires `beforeinstallprompt` and tells a page in a tab
// nothing about a home-screen icon, which is exactly why the
// suspected-installed heuristic skips iOS — and why the primary action
// could never open there. Where the browser cannot answer, the reader
// does: the step stays completable, and says what it is doing.
const canDetectInstall = computed(() => !isIOSView.value);

const canProceed = computed(
    () =>
        isStandalone.value ||
        isSuspectedInstalled.value ||
        wasInstalled.value ||
        (!canDetectInstall.value && !isCheckingInstall.value),
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
