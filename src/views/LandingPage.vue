<template>
    <!-- The start page, for a browser tab without a session: a newcomer's, or
         a reader's whose book is still on the device and who only needs to
         sign in again. Public, and it asks the server for nothing: it has to
         work for someone who cannot get in. The first screen is the logo, the
         psalm and the one button, at its foot; a taste of the book and what it
         can do follow below. -->
    <div class="flex h-full flex-col bg-background">
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <!-- Sized for a phone in the hand, not for the drawing of one: the
                 design's screen is some 350 px wide, a Pixel's 412, and the
                 same rem looked a size smaller there with a hole under the
                 psalm. So a fifth larger than drawn, the logo more than that.
                 Still rem, so Größe moves it all, with caps where the screen
                 runs out. On a short one (an iPhone SE's Safari leaves some
                 550 px) the logo, the psalm and the space between give way to
                 the height, so the button, its note and „Mehr erfahren" stay on
                 the first screen. The title gives way to the width, because at
                 Größe 200 % the one word has to fit a phone (Firefox sets it
                 wider than Chromium, hence the 4.9 words to the width and the
                 sides at 1.25rem, not 1.5). -->
            <section
                class="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(min(2.25rem,4svh),env(safe-area-inset-top))]"
            >
                <GesangbuchLogo class="h-[min(6.5rem,13svh)] shrink-0 self-start" />
                <p class="label-micro mt-[min(2.5rem,5svh)] text-xs text-flourish">
                    Johannische Kirche
                </p>
                <h1
                    class="mt-1.5 font-display text-[length:min(3.5rem,calc((100vw_-_2.5rem)/4.9))] font-semibold leading-none tracking-tight"
                >
                    Gesangbuch
                </h1>

                <figure class="mt-[min(2rem,4svh)] border-l-2 border-flourish pl-5">
                    <blockquote
                        class="font-display text-[length:min(1.7rem,4.5svh)] font-medium leading-[1.3]"
                    >
                        Jauchzet dem Herrn,
                        <br />
                        alle Welt;
                        <br />
                        singet,
                        <br />
                        rühmet und lobet!
                    </blockquote>
                    <figcaption class="label-micro mt-3 text-xs text-flourish">Psalm 98</figcaption>
                </figure>

                <div class="mt-auto grid gap-2 pt-[min(2.5rem,5svh)]">
                    <Button size="lg" class="h-14 w-full text-base" @click="useIt">
                        {{ ctaLabel }}
                    </Button>
                    <p
                        v-if="ctaNote"
                        class="text-center text-[0.9375rem] leading-relaxed text-muted-foreground"
                    >
                        {{ ctaNote }}
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        class="justify-self-center text-muted-foreground"
                        @click="showMore"
                    >
                        Mehr erfahren
                        <ChevronDown aria-hidden="true" />
                    </Button>
                </div>
            </section>

            <div
                ref="more"
                class="mx-auto w-full max-w-md px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
            >
                <!-- Columns of flex, not grid: a grid track grows to its
                     longest unbroken word, and the verse at its largest has
                     words wider than a phone where no hyphenation is at hand
                     (WebKit's). A flex column stays the width it is given. -->
                <div class="flex flex-col gap-8 border-t border-border pt-6">
                    <!-- A verse to read, at a size the reader picks: what the
                         app's own Größe does to every page. -->
                    <figure class="flex flex-col gap-2">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <span class="label-micro text-flourish">Hineinlesen</span>
                            <span
                                class="inline-flex items-stretch overflow-hidden rounded-md border border-input bg-card"
                            >
                                <button
                                    type="button"
                                    class="h-8 w-9 text-sm font-semibold text-primary transition-colors hover:bg-muted disabled:text-muted-foreground disabled:hover:bg-transparent"
                                    aria-label="Schrift kleiner"
                                    :disabled="sizeIndex === 0"
                                    @click="sizeIndex--"
                                >
                                    A−
                                </button>
                                <output
                                    class="grid min-w-[3.25rem] place-items-center border-x border-border text-xs tabular-nums text-muted-foreground"
                                    aria-live="polite"
                                >
                                    {{ Math.round(SIZES[sizeIndex] * 100) }} %
                                </output>
                                <button
                                    type="button"
                                    class="h-8 w-9 text-sm font-semibold text-primary transition-colors hover:bg-muted disabled:text-muted-foreground disabled:hover:bg-transparent"
                                    aria-label="Schrift größer"
                                    :disabled="sizeIndex === SIZES.length - 1"
                                    @click="sizeIndex++"
                                >
                                    A+
                                </button>
                            </span>
                        </div>
                        <h2 class="mt-0.5 font-hymnal text-lg">Lobe den Herren</h2>
                        <!-- Hyphenated, and broken mid-word where even that is
                             not enough: at the largest size „mächtigen" alone is
                             wider than a phone. Each line hangs, so one that
                             wraps reads as the same line going on. -->
                        <p
                            lang="de"
                            class="relative hyphens-auto break-words pl-[1.5em] font-hymnal leading-normal"
                            :style="{ fontSize: `${SIZES[sizeIndex] * 1.0625}rem` }"
                        >
                            <span class="absolute left-0 top-0 tabular-nums text-flourish">1</span>
                            <span
                                v-for="line in VERSE"
                                :key="line"
                                class="block pl-[1em] -indent-[1em]"
                            >
                                {{ line }}
                            </span>
                        </p>
                        <figcaption class="text-xs text-muted-foreground">
                            Text: Joachim Neander, 1680
                        </figcaption>
                    </figure>

                    <section class="flex flex-col gap-1.5">
                        <h2 class="label-micro text-flourish">Was es kann</h2>
                        <ul class="divide-y divide-border">
                            <li
                                v-for="feature in FEATURES"
                                :key="feature.title"
                                class="grid grid-cols-[4.6rem_minmax(0,1fr)] gap-3 py-2.5"
                            >
                                <span class="label-micro pt-0.5 font-semibold text-flourish">
                                    {{ feature.title }}
                                </span>
                                <span
                                    lang="de"
                                    class="hyphens-auto break-words text-[0.875rem] leading-relaxed"
                                >
                                    {{ feature.text }}
                                </span>
                            </li>
                        </ul>
                    </section>

                    <section class="flex flex-col gap-3 text-center">
                        <p class="text-sm leading-relaxed text-muted-foreground">
                            Für ein neues Konto brauchen Sie Ihren Aktivierungscode. Er steht auf
                            dem Aufkleber auf der Rückseite Ihres Gesangbuch-Lesezeichens.
                        </p>
                        <Button variant="outline" size="lg" class="w-full" @click="useIt">
                            {{ ctaLabel }}
                        </Button>
                        <nav
                            class="mt-1 flex items-center justify-center gap-3 text-xs text-muted-foreground"
                            aria-label="Rechtliches"
                        >
                            <RouterLink
                                to="/impressum"
                                class="transition-colors hover:text-foreground"
                            >
                                Impressum
                            </RouterLink>
                            <span aria-hidden="true">·</span>
                            <RouterLink
                                to="/datenschutz"
                                class="transition-colors hover:text-foreground"
                            >
                                Datenschutz
                            </RouterLink>
                        </nav>
                    </section>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { ChevronDown } from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';

import { usePWA } from '@/composables/usePWA';

import GesangbuchLogo from '@/components/shell/GesangbuchLogo.vue';
import { Button } from '@/components/ui/button';

const router = useRouter();
const { isIOS, isAndroid, wasInstalled, isKnownInstalled } = usePWA();
const songsStore = useSongsStore();

const SIZES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
const sizeIndex = ref(1);

const VERSE = [
    'Lobe den Herren, den mächtigen König der Ehren,',
    'meine geliebete Seele, das ist mein Begehren.',
    'Kommet zuhauf,',
    'Psalter und Harfe, wacht auf,',
    'lasset den Lobgesang hören!',
];

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

// The book is already in this browser and only its session ran out, or was
// ended: its reader has been through the install page once and is after the
// sign-in. A demo's songs do not count; they come with no account to return to.
const bookHere = computed(() => songsStore.hasSongs && !songsStore.isDemo);

const ctaLabel = computed(() => {
    if (installedHere.value) return 'In der App öffnen';
    if (bookHere.value) return 'Anmelden';
    return 'Gesangbuch nutzen';
});
const ctaNote = computed(() => {
    if (installedHere.value) return 'Das Gesangbuch ist auf diesem Gerät installiert.';
    if (bookHere.value) return 'Ihr Gesangbuch ist noch in diesem Browser gespeichert.';
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
 * to the sign-in. So does a browser that holds the book already.
 */
function useIt() {
    const signIn = !installedHere.value && (isDesktop.value || bookHere.value);
    router.push(signIn ? '/anmelden' : '/installieren');
}

const more = ref<HTMLElement | null>(null);

function showMore() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    more.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
</script>
