<template>
    <ResponsivePanel
        :open="isOpen"
        :anchor="anchor"
        label="Gottesdienst übernehmen"
        :snap-points="snapPoints"
        :initial-snap-point="0.5"
        drawer-class="h-full max-h-[97dvh]"
        popover-class="w-80"
        @update:open="onOpenChange"
    >
        <div
            class="sticky top-0 z-20 flex items-center justify-between gap-2 bg-popover py-1 pl-4 pr-2"
        >
            <PanelTitle>Gottesdienst übernehmen</PanelTitle>
            <Button variant="ghost" class="text-primary" @click="emit('close')">Fertig</Button>
        </div>

        <div v-if="isLoading" class="flex items-center justify-center p-12">
            <Spinner size="lg" />
        </div>

        <!-- Nothing on offer: with only the playlist provider registered this is
             simply "no playlists yet", so it points at the one path that always
             works instead of at a source that does not exist. -->
        <div
            v-else-if="!groups.length"
            class="flex flex-col items-center justify-center px-6 py-12 text-center"
        >
            <Church class="size-12 text-muted-foreground" stroke-width="1.5" aria-hidden="true" />
            <p class="mt-3 text-sm text-muted-foreground">
                Es liegt kein fertiger Ablauf vor. Merken Sie die Lieder einzeln vor — im Lied oder
                über einen langen Druck in der Liste.
            </p>
        </div>

        <div v-else class="px-4 pb-6">
            <section v-for="group in groups" :key="group.provider.id" class="mt-1">
                <div class="flex items-center gap-3">
                    <span class="label-micro shrink-0 text-gold">{{ group.provider.label }}</span>
                    <Separator class="flex-1" />
                </div>
                <p
                    v-if="group.provider.description"
                    class="mt-1.5 text-sm leading-snug text-muted-foreground"
                >
                    {{ group.provider.description }}
                </p>

                <ul class="mt-1 divide-y divide-border">
                    <li v-for="offer in group.offers" :key="offer.id">
                        <button
                            type="button"
                            class="flex w-full items-center gap-3 rounded-sm py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="emit('select', group.provider.id, offer.id)"
                        >
                            <span
                                class="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-xl leading-none"
                            >
                                <template v-if="offer.emoji">{{ offer.emoji }}</template>
                                <Church v-else class="size-[18px]" aria-hidden="true" />
                            </span>
                            <span class="min-w-0 flex-1">
                                <span
                                    class="block break-words text-[15px] font-medium leading-tight"
                                >
                                    {{ offer.title }}
                                </span>
                                <span class="mt-0.5 block text-sm text-muted-foreground">
                                    {{ offerMeta(offer) }}
                                </span>
                            </span>
                            <ChevronRight
                                class="size-4 shrink-0 text-muted-foreground/70"
                                aria-hidden="true"
                            />
                        </button>
                    </li>
                </ul>
            </section>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import { ChevronRight, Church } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

import type { PanelAnchor } from '@/lib/anchor';
import {
    type ServicePlanOffer,
    type ServicePlanOfferGroup,
    collectServicePlanOffers,
    formatServiceDate,
} from '@/services/servicePlans';

const props = defineProps<{
    isOpen: boolean;
    /** What the desktop popover opens against — the control that opened it. */
    anchor?: PanelAnchor;
}>();

const emit = defineEmits<{
    close: [];
    select: [providerId: string, offerId: string];
}>();

// Sheet snap points, as everywhere else in the app
const snapPoints = [0.5, 0.75, 1];

const groups = ref<ServicePlanOfferGroup[]>([]);
const isLoading = ref(false);

// Offers are gathered per opening, never cached: a playlist may have changed
// since last time, and a backend provider has to be asked when it is needed.
watch(
    () => props.isOpen,
    async (isOpen) => {
        if (!isOpen) return;
        isLoading.value = true;
        try {
            groups.value = await collectServicePlanOffers();
        } finally {
            isLoading.value = false;
        }
    },
    { immediate: true },
);

function onOpenChange(open: boolean) {
    if (!open) emit('close');
}

function offerMeta(offer: ServicePlanOffer): string {
    const songs = `${offer.songCount} ${offer.songCount === 1 ? 'Lied' : 'Lieder'}`;
    const date = offer.date ? formatServiceDate(offer.date) : '';
    return [date, offer.subtitle, songs].filter(Boolean).join(' · ');
}
</script>
