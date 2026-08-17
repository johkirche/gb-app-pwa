<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Datenschutzerklärung">
            <template #leading>
                <BackButton default-href="/login" />
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto w-full max-w-prose px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8"
            >
                <section>
                    <div class="flex items-center gap-4">
                        <h2 class="font-display text-2xl font-semibold">Verantwortlicher</h2>
                        <Separator class="min-w-10 flex-1" />
                    </div>
                    <div class="mt-5 space-y-3 text-[15px] leading-relaxed">
                        <p class="italic text-gold">
                            [TODO: Von der Organisation zu ergänzen – Name und Anschrift des
                            Verantwortlichen im Sinne der DSGVO sowie ggf. Kontaktdaten des
                            Datenschutzbeauftragten.]
                        </p>
                        <p>
                            Kontakt:
                            <a
                                :href="`mailto:${SUPPORT_EMAIL}`"
                                class="text-primary underline-offset-4 hover:underline"
                            >
                                {{ SUPPORT_EMAIL }}
                            </a>
                        </p>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="font-display text-2xl font-semibold">Überblick</h2>
                        <Separator class="min-w-10 flex-1" />
                    </div>
                    <div class="mt-5 space-y-3 text-[15px] leading-relaxed">
                        <p>
                            Diese App ist ein digitales Gesangbuch, das nach dem Herunterladen der
                            Inhalte weitgehend offline funktioniert. Personenbezogene Daten werden
                            nur verarbeitet, soweit dies für die Anmeldung und die Bereitstellung
                            der Inhalte erforderlich ist. Die App setzt keine Analyse- oder
                            Tracking-Dienste ein und stellt keine Anfragen an Drittanbieter.
                        </p>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="font-display text-2xl font-semibold">
                            Lokal auf Ihrem Gerät gespeicherte Daten
                        </h2>
                        <Separator class="min-w-10 flex-1" />
                    </div>
                    <div class="mt-5 space-y-3 text-[15px] leading-relaxed">
                        <p>
                            Damit die App offline nutzbar ist, speichert sie Daten ausschließlich
                            lokal auf Ihrem Gerät:
                        </p>
                        <ul class="list-disc space-y-1.5 pl-5">
                            <li>
                                <strong>App-Datenbank</strong>
                                (IndexedDB &bdquo;GesangbuchDB&ldquo;): Lieder und Notendateien
                                (Tabellen
                                <em>songs</em>
                                ,
                                <em>files</em>
                                ), Anmelde- und Sitzungsdaten (
                                <em>auth</em>
                                ), Profildaten wie E-Mail-Adresse, Name und Rolle (
                                <em>users</em>
                                ), Playlists (
                                <em>playlists</em>
                                ), Darstellungs-Einstellungen (
                                <em>preferences</em>
                                ), Favoriten (
                                <em>favorites</em>
                                ) sowie Synchronisierungs-Metadaten (
                                <em>meta</em>
                                ).
                            </li>
                            <li>
                                <strong>Browser-Speicher</strong>
                                (localStorage): das gewählte Farbschema (
                                <em>settings.theme</em>
                                ) und der Fortschritt der Ersteinrichtung (
                                <em>onboarding.inProgress</em>
                                ,
                                <em>onboarding.currentStep</em>
                                ).
                            </li>
                            <li>
                                <strong>Service-Worker-Caches</strong>
                                : die App-Dateien selbst (Workbox-Precache, einschließlich der
                                Klangdateien für die Notenwiedergabe) sowie die Caches
                                <em>api-cache</em>
                                ,
                                <em>image-cache</em>
                                und
                                <em>font-cache</em>
                                .
                            </li>
                        </ul>
                        <p>
                            Diese Daten verbleiben auf Ihrem Gerät und werden nicht an Dritte
                            übermittelt. Beim Abmelden werden Sitzungsdaten sowie Ihre persönlichen
                            Daten (Playlists, Favoriten, Einstellungen) von diesem Gerät entfernt;
                            bei einer Kontolöschung werden sämtliche lokal gespeicherten Daten
                            gelöscht.
                        </p>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="font-display text-2xl font-semibold">Server-Anfragen</h2>
                        <Separator class="min-w-10 flex-1" />
                    </div>
                    <div class="mt-5 space-y-3 text-[15px] leading-relaxed">
                        <p>
                            Die App kommuniziert ausschließlich mit dem für sie konfigurierten
                            Backend der Johannischen Kirche (gb26-admin.johannische-kirche.org).
                            Dabei werden folgende Schnittstellen verwendet:
                        </p>
                        <ul class="list-disc space-y-1.5 pl-5">
                            <li>
                                <em>/auth/&hellip;</em>
                                &ndash; Anmeldung, Sitzungsverlängerung, Abmeldung und Zurücksetzen
                                des Passworts
                            </li>
                            <li>
                                <em>/graphql</em>
                                &ndash; Abruf der Liederdaten
                            </li>
                            <li>
                                <em>/assets/&hellip;</em>
                                &ndash; Abruf der Notendateien
                            </li>
                            <li>
                                <em>/users/&hellip;</em>
                                &ndash; Abruf der eigenen Profildaten und Kontolöschung
                            </li>
                            <li>
                                <em>/directus-user-register-extension/&hellip;</em>
                                &ndash; Registrierung mit Aktivierungscode
                            </li>
                        </ul>
                        <p>
                            Anmeldungen und andere Anfragen an das Backend können dort im Rahmen der
                            üblichen serverseitigen Protokollierung erfasst werden.
                        </p>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="font-display text-2xl font-semibold">Keine Drittanbieter</h2>
                        <Separator class="min-w-10 flex-1" />
                    </div>
                    <div class="mt-5 space-y-3 text-[15px] leading-relaxed">
                        <p>
                            Die Notenwiedergabe lädt die benötigten Klangdateien (Soundfonts) von
                            derselben Quelle wie die App selbst; es finden dabei keine Anfragen an
                            Drittanbieter statt. Die App setzt keine Cookies zu Werbe- oder
                            Analysezwecken und keine Tracking-Dienste ein.
                        </p>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="font-display text-2xl font-semibold">
                            Rechtsgrundlagen, Speicherdauer und Ihre Rechte
                        </h2>
                        <Separator class="min-w-10 flex-1" />
                    </div>
                    <div class="mt-5 space-y-3 text-[15px] leading-relaxed">
                        <p class="italic text-gold">
                            [TODO: Von der Organisation zu ergänzen – u.&nbsp;a. Rechtsgrundlagen
                            der Verarbeitung, Speicherdauer der serverseitig gespeicherten Daten
                            sowie die Betroffenenrechte (Auskunft, Berichtigung, Löschung,
                            Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei
                            einer Aufsichtsbehörde).]
                        </p>
                        <p class="italic text-gold">[TODO: Stand dieser Erklärung ergänzen]</p>
                    </div>
                </section>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Separator } from '@/components/ui/separator';

import { SUPPORT_EMAIL } from '@/config/support';
</script>
