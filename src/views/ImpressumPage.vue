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
                <section>
                    <div class="flex items-center gap-4">
                        <h2 class="shrink-0 font-display text-2xl font-semibold">
                            Angaben gemäß § 5 DDG
                        </h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-5 space-y-5 text-[15px] leading-relaxed">
                        <div>
                            <h3 class="text-sm font-semibold">Anbieter</h3>
                            <p class="mt-1 italic text-gold">
                                [TODO: Von der Organisation zu ergänzen]
                            </p>
                        </div>

                        <div>
                            <h3 class="text-sm font-semibold">Anschrift</h3>
                            <p class="mt-1 italic text-gold">
                                [TODO: Von der Organisation zu ergänzen]
                            </p>
                        </div>

                        <div>
                            <h3 class="text-sm font-semibold">Vertretungsberechtigte</h3>
                            <p class="mt-1 italic text-gold">
                                [TODO: Von der Organisation zu ergänzen]
                            </p>
                        </div>
                    </div>
                </section>

                <section class="mt-12">
                    <div class="flex items-center gap-4">
                        <h2 class="shrink-0 font-display text-2xl font-semibold">Kontakt</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-5 space-y-5 text-[15px] leading-relaxed">
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
                            <p class="mt-1 italic text-gold">
                                [TODO: Von der Organisation zu ergänzen]
                            </p>
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
                    <div class="mt-5 text-[15px] leading-relaxed">
                        <p class="italic text-gold">[TODO: Von der Organisation zu ergänzen]</p>
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
