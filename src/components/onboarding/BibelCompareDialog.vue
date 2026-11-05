<template>
    <Dialog v-model:open="open">
        <!-- Flex and no padding above and below, so the button can stay in reach
             while the passages go by, as in the Einstellungen' Gemeinde dialog. -->
        <DialogContent class="flex max-h-[90dvh] flex-col overflow-y-auto py-0">
            <DialogHeader class="pt-6">
                <DialogTitle>Luther und Menge im Vergleich</DialogTitle>
                <DialogDescription>
                    Zwei bekannte Stellen in beiden Übersetzungen.
                </DialogDescription>
            </DialogHeader>

            <section v-for="sample in BIBEL_SAMPLES" :key="sample.slug" class="flex flex-col gap-2">
                <h3 class="label-micro text-flourish">
                    {{ versesRefLabel(sample, sample.verses) }}
                </h3>
                <div class="rounded-lg bg-muted p-3">
                    <p class="text-sm font-medium">Luther (1912)</p>
                    <p class="mt-1 font-hymnal leading-relaxed">{{ sample.luther }}</p>
                </div>
                <div class="rounded-lg bg-muted p-3">
                    <p class="text-sm font-medium">Menge (1939)</p>
                    <p
                        v-if="sample.mengeHeading"
                        class="mt-1 font-display font-semibold leading-tight"
                    >
                        {{ sample.mengeHeading }}
                    </p>
                    <p class="mt-1 font-hymnal leading-relaxed">{{ sample.menge }}</p>
                    <p v-if="sample.mengeNote" class="mt-1 text-sm text-muted-foreground">
                        Anmerkung: {{ sample.mengeNote.word }} {{ sample.mengeNote.text }}
                    </p>
                </div>
            </section>

            <DialogFooter class="sticky bottom-0 z-10 bg-popover pb-6 pt-2">
                <DialogClose as-child>
                    <Button type="button">Zurück zur Auswahl</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { BIBEL_SAMPLES } from '@/components/onboarding/bibelCompare';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { versesRefLabel } from '@/utils/bibelVerses';

const open = defineModel<boolean>('open', { required: true });
</script>
