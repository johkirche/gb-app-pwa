<template>
    <!-- Where a demo ends: on the link itself once it has closed, and on the
         first start after that on every phone that opened it. The songs are
         already gone by then, so this is the last thing the visitor sees of the
         app — the place to say what the whole book holds. Not yet how to get
         it: until the book is released, there is no account to point to. -->
    <div class="flex h-full flex-col overflow-y-auto bg-background">
        <div
            class="page-col flex min-h-full max-w-md flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]"
        >
            <header>
                <img src="/logo.svg" alt="" class="h-20 w-auto" />
                <p class="label-micro mt-8 text-flourish">Vorschau beendet</p>
                <h1 class="mt-2 text-balance font-display text-4xl font-semibold leading-tight">
                    Danke fürs Ausprobieren
                </h1>
                <p class="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Die Vorschau hatte nur ein paar Lieder. Das ganze Gesangbuch kann mehr:
                </p>
            </header>

            <ul class="mt-8 divide-y divide-border border-y border-border">
                <li v-for="feature in FEATURES" :key="feature.title" class="flex gap-4 py-4">
                    <span
                        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
                        aria-hidden="true"
                    >
                        <component :is="feature.icon" class="size-5" stroke-width="1.5" />
                    </span>
                    <div class="min-w-0">
                        <p class="font-display text-lg font-semibold leading-snug">
                            {{ feature.title }}
                        </p>
                        <p class="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                            {{ feature.text }}
                        </p>
                    </div>
                </li>
            </ul>

            <div
                class="mt-auto flex items-center justify-center gap-3 pt-10 text-xs text-muted-foreground"
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
    </div>
</template>

<script setup lang="ts">
import { ALargeSmall, BookOpen, ClipboardList, Music, Play, WifiOff } from 'lucide-vue-next';

// What a demo leaves out (see the songs store's isDemo), said as what it is
// for rather than what it is called in the app.
const FEATURES = [
    {
        icon: Music,
        title: 'Jedes Lied, mit Noten',
        text: 'Suchen Sie nach Nummer, Titel oder einer Zeile aus dem Text.',
    },
    {
        icon: WifiOff,
        title: 'Auch ohne Netz',
        text: 'Alle Lieder und Noten liegen auf dem Gerät. In der Kirche brauchen Sie keinen Empfang.',
    },
    {
        icon: ClipboardList,
        title: 'Einen Ablauf zusammenstellen',
        text: 'Lieder für den Gottesdienst vormerken, ordnen und als Playlist sichern.',
    },
    {
        icon: Play,
        title: 'Die Melodie hören',
        text: 'Jedes Lied lässt sich abspielen, die klingende Note wird mitgezeigt. Zum Üben und Mitsingen.',
    },
    {
        icon: ALargeSmall,
        title: 'Lesen, wie es Ihnen passt',
        text: 'Größere Schrift, ein dunkles Design für den Abend und das Querformat für lange Strophen.',
    },
    {
        icon: BookOpen,
        title: 'Die Bibel dazu',
        text: 'Menge und Luther, mit Leseplänen und den Bibelstellen zu den Liedern.',
    },
];
</script>
