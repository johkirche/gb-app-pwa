<template>
    <!-- The start page, for a browser that has nothing of the Gesangbuch yet.
         Public, and it asks the server for nothing: it has to work for someone
         who cannot get in. The first screen is the psalm and the one button;
         a taste of the book and what it can do follow below. -->
    <div class="flex h-full flex-col bg-background">
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <section
                class="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-center"
            >
                <img src="/logo.svg" alt="" class="size-24" />
                <p class="label-micro mt-6 text-muted-foreground">Johannische Kirche</p>
                <!-- 2.75rem, not text-5xl: at Größe 200 % the one word has to fit a
                     phone, and Firefox sets it wider than Chromium. -->
                <h1
                    class="mt-2 font-display text-[2.75rem] font-semibold leading-tight tracking-tight"
                >
                    Gesangbuch
                </h1>

                <figure class="mt-10">
                    <blockquote class="font-display text-2xl italic leading-snug">
                        Jauchzet dem Herrn,
                        <br />
                        alle Welt;
                        <br />
                        singet,
                        <br />
                        rühmet und lobet!
                    </blockquote>
                    <figcaption class="label-micro mt-3 text-muted-foreground">Psalm 98</figcaption>
                </figure>

                <div class="mt-12 flex w-full flex-col items-center gap-3">
                    <Button size="lg" class="w-full" @click="useIt">{{ ctaLabel }}</Button>
                    <p v-if="ctaNote" class="text-sm leading-relaxed text-muted-foreground">
                        {{ ctaNote }}
                    </p>
                    <Button variant="ghost" size="sm" class="mt-2" @click="showMore">
                        Mehr erfahren
                        <ChevronDown aria-hidden="true" />
                    </Button>
                </div>
            </section>

            <div
                ref="more"
                class="mx-auto w-full max-w-md px-6 pb-[max(3rem,env(safe-area-inset-bottom))]"
            >
                <!-- A verse to read, at a size the reader picks: what the app's
                     own Größe does to every page. -->
                <figure class="rounded-lg border border-border bg-card px-5 py-5">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <span class="label-micro text-muted-foreground">Hineinlesen</span>
                        <span class="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                aria-label="Schrift kleiner"
                                :disabled="sizeIndex === 0"
                                @click="sizeIndex--"
                            >
                                A−
                            </Button>
                            <output
                                class="min-w-[3.5rem] text-center text-sm tabular-nums"
                                aria-live="polite"
                            >
                                {{ Math.round(SIZES[sizeIndex] * 100) }} %
                            </output>
                            <Button
                                variant="outline"
                                size="sm"
                                aria-label="Schrift größer"
                                :disabled="sizeIndex === SIZES.length - 1"
                                @click="sizeIndex++"
                            >
                                A+
                            </Button>
                        </span>
                    </div>
                    <h2 class="mt-4 font-display text-2xl font-semibold">Lobe den Herren</h2>
                    <!-- Hyphenated, and broken mid-word where even that is not
                         enough: at the largest size „mächtigen" alone is wider
                         than a phone. -->
                    <p
                        lang="de"
                        class="mt-3 hyphens-auto break-words leading-relaxed"
                        :style="{ fontSize: `${SIZES[sizeIndex] * 1.0625}rem` }"
                    >
                        <span class="mr-1 font-semibold text-flourish">1</span>
                        Lobe den Herren, den mächtigen König der Ehren,
                        <br />
                        meine geliebete Seele, das ist mein Begehren.
                        <br />
                        Kommet zuhauf,
                        <br />
                        Psalter und Harfe, wacht auf,
                        <br />
                        lasset den Lobgesang hören!
                    </p>
                    <figcaption class="mt-3 text-sm text-muted-foreground">
                        Text: Joachim Neander, 1680
                    </figcaption>
                </figure>

                <section class="mt-10">
                    <h2 class="label-micro text-muted-foreground">Was es kann</h2>
                    <ul class="mt-3 divide-y divide-border">
                        <li v-for="feature in FEATURES" :key="feature.title" class="py-3">
                            <p class="font-medium">{{ feature.title }}</p>
                            <p
                                class="mt-0.5 text-[0.9375rem] leading-relaxed text-muted-foreground"
                            >
                                {{ feature.text }}
                            </p>
                        </li>
                    </ul>
                </section>

                <section class="mt-10 text-center">
                    <p class="text-[0.9375rem] leading-relaxed">
                        Für ein neues Konto brauchen Sie Ihren Aktivierungscode. Er steht auf dem
                        Aufkleber auf der Rückseite Ihres Gesangbuch-Lesezeichens.
                    </p>
                    <Button variant="outline" size="lg" class="mt-5 w-full" @click="useIt">
                        {{ ctaLabel }}
                    </Button>
                </section>

                <nav
                    class="mt-10 flex items-center justify-center gap-3 text-xs text-muted-foreground"
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
import { computed, ref } from 'vue';

import { ChevronDown } from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';

import { usePWA } from '@/composables/usePWA';

import { Button } from '@/components/ui/button';

const router = useRouter();
const { isIOS, isAndroid, wasInstalled, isKnownInstalled } = usePWA();

const SIZES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
const sizeIndex = ref(1);

const FEATURES = [
    { title: 'Offline', text: 'Einmal geladen, auch im Gottesdienst ohne Netz dabei.' },
    { title: 'Noten', text: 'Die Melodie mitlesen und vorspielen lassen.' },
    { title: 'Größe', text: 'Die Schrift so groß, wie Sie sie brauchen.' },
    { title: 'Bibel', text: 'Bibelstellen zu den Liedern, Playlisten für den Gottesdienst.' },
];

const isDesktop = computed(() => !isIOS.value && !isAndroid.value);
// Chrome on Android said the app is on this device. A button cannot open it from
// here (see InstallPWAStep), so it leads to the page that says how.
const installedHere = computed(
    () => isAndroid.value && (isKnownInstalled.value || wasInstalled.value),
);

const ctaLabel = computed(() => (installedHere.value ? 'In der App öffnen' : 'Gesangbuch nutzen'));
const ctaNote = computed(() => {
    if (installedHere.value) return 'Das Gesangbuch ist auf diesem Gerät installiert.';
    if (isDesktop.value)
        return 'Läuft direkt im Browser. Installieren geht später über die Adressleiste.';
    return null;
});

/**
 * Where the button leads depends on what installing is worth here. On an
 * iPhone or iPad a great deal: the home-screen app keeps storage of its own,
 * and Safari may clear a site's data after a while. On Android the browser and
 * the app share their storage, so the install page offers both alike. At a
 * computer it is a convenience, and not every browser can, so it goes straight
 * to the sign-in.
 */
function useIt() {
    router.push(isDesktop.value ? '/anmelden' : '/installieren');
}

const more = ref<HTMLElement | null>(null);

function showMore() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    more.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
</script>
