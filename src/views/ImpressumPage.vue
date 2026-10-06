<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Impressum">
            <template #leading>
                <BackButton default-href="/login" />
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto w-full max-w-prose px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8"
            >
                <!-- The organisation's details come from Directus (rechtstexte),
                     where the organisation keeps them; what the app itself
                     says — the e-mail, the Bible's sources — is written here. -->
                <section>
                    <div class="flex items-center gap-4">
                        <h2 class="shrink-0 font-display text-2xl font-semibold">
                            Angaben gemäß § 5 DDG
                        </h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-5 space-y-5 text-[0.9375rem] leading-relaxed">
                        <div>
                            <h3 class="text-sm font-semibold">Anbieter</h3>
                            <RechtstextValue
                                class="mt-1"
                                :value="texte?.impressum_anbieter"
                                :state="state"
                            />
                        </div>

                        <div>
                            <h3 class="text-sm font-semibold">Anschrift</h3>
                            <RechtstextValue
                                class="mt-1"
                                :value="texte?.impressum_anschrift"
                                :state="state"
                            />
                        </div>

                        <div>
                            <h3 class="text-sm font-semibold">Vertretungsberechtigte</h3>
                            <RechtstextValue
                                class="mt-1"
                                :value="texte?.impressum_vertretung"
                                :state="state"
                            />
                        </div>

                        <!-- Only where there is one: not every organisation is registered. -->
                        <div v-if="texte?.impressum_register">
                            <h3 class="text-sm font-semibold">Register</h3>
                            <RechtstextValue
                                class="mt-1"
                                :value="texte.impressum_register"
                                :state="state"
                            />
                        </div>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="shrink-0 font-display text-2xl font-semibold">Kontakt</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-5 space-y-5 text-[0.9375rem] leading-relaxed">
                        <div>
                            <h3 class="text-sm font-semibold">E-Mail</h3>
                            <p class="mt-1">
                                <a
                                    :href="`mailto:${SUPPORT_EMAIL}`"
                                    class="text-primary underline-offset-4 hover:underline"
                                >
                                    {{ SUPPORT_EMAIL }}
                                </a>
                            </p>
                        </div>

                        <div>
                            <h3 class="text-sm font-semibold">Telefon</h3>
                            <RechtstextValue
                                class="mt-1"
                                :value="texte?.impressum_telefon"
                                :state="state"
                            />
                        </div>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="shrink-0 font-display text-2xl font-semibold">
                            Verantwortlich für den Inhalt
                        </h2>
                        <Separator class="flex-1" />
                    </div>
                    <RechtstextValue
                        class="mt-5 text-[0.9375rem] leading-relaxed"
                        :value="texte?.impressum_verantwortlich"
                        :state="state"
                    />
                </section>

                <!-- What the Bible is built from. Both texts are free of rights;
                     naming them is courtesy, and tells the reader which wording
                     they read. -->
                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="shrink-0 font-display text-2xl font-semibold">Bibeltexte</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-5 space-y-5 text-[0.9375rem] leading-relaxed">
                        <div v-for="source in BIBEL_SOURCES" :key="source.name">
                            <h3 class="text-sm font-semibold">{{ source.name }}</h3>
                            <p class="mt-1">
                                {{ source.license }}. Textgrundlage:
                                <a
                                    :href="source.url"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-primary underline-offset-4 hover:underline"
                                >
                                    {{ source.via }}
                                </a>
                            </p>
                        </div>
                        <p class="text-sm text-muted-foreground">
                            Die Texte werden mit der App ausgeliefert; Überschriften und Absätze
                            folgen der jeweiligen Ausgabe.
                        </p>
                    </div>
                </section>

                <p v-if="stand" class="mt-12 text-sm text-muted-foreground">Stand: {{ stand }}</p>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useRechtstexte } from '@/composables/useRechtstexte';

import RechtstextValue from '@/components/legal/RechtstextValue.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Separator } from '@/components/ui/separator';

import { SUPPORT_EMAIL } from '@/config/support';

const { texte, state } = useRechtstexte();

const stand = computed(() =>
    texte.value?.stand
        ? new Date(texte.value.stand).toLocaleDateString('de-DE', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
          })
        : null,
);

/** Where the Bible texts come from (scripts/build-bibel.py, scripts/build-luther.py). */
const BIBEL_SOURCES = [
    {
        name: 'Menge-Bibel (1939)',
        license: 'Gemeinfrei, als Ausgabe unter CC0 1.0 veröffentlicht',
        via: 'github.com/renehamburger/Menge-Bibel',
        url: 'https://github.com/renehamburger/Menge-Bibel',
    },
    {
        name: 'Lutherbibel (1912)',
        license: 'Gemeinfrei',
        via: 'Zefania-XML-Ausgabe (toledot.info, 2022)',
        url: 'https://sourceforge.net/projects/zefania-sharp/files/Bibles/GER/Lutherbibel/Luther%201912/',
    },
];
</script>
