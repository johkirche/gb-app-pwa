<!--
    Wie weit die Suche greift: nur über Titel und Nummern, oder auch durch die
    Strophen.

    Zwei Felder statt einer stillschweigend über alles laufenden Suche, weil die
    beiden Fragen verschieden sind. „744" oder „Großer Gott" ist eine Frage nach
    einem bestimmten Lied und will eine kurze Liste; „bis hierher hat mich Gott
    gebracht" ist eine Frage nach der Zeile, an die man sich erinnert, und muss
    dafür durch den ganzen Text — in dem „Gott" fast überall steht. Wer nur die
    Nummer tippt, soll für die zweite Frage nicht bezahlen.
-->
<template>
    <ToggleGroup
        type="single"
        :model-value="scope"
        class="w-full"
        aria-label="Suchbereich"
        @update:model-value="onUpdate"
    >
        <!-- h-auto und whitespace-normal gegen die Vorgaben des Bausteins:
             „Titel + Text" in einer Zeile, die nicht umbrechen darf, läuft bei
             200 % Größe seitlich aus dem Telefon heraus. Umbrechen darf es,
             abgeschnitten werden nicht — die Beschriftung ist die halbe
             Erklärung (tests/e2e/readability-scale.spec.ts). -->
        <ToggleGroupItem
            value="titel"
            class="h-auto min-h-8 min-w-0 flex-1 whitespace-normal px-2 py-1.5"
            aria-label="Nur in Titeln und Nummern suchen"
        >
            Titel
        </ToggleGroupItem>
        <ToggleGroupItem
            value="text"
            class="h-auto min-h-8 min-w-0 flex-1 whitespace-normal px-2 py-1.5"
            aria-label="Auch in den Strophen suchen"
        >
            Titel + Text
        </ToggleGroupItem>
    </ToggleGroup>
</template>

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { SearchScope } from '@/utils/songSearch';

defineProps<{
    scope: SearchScope;
}>();

const emit = defineEmits<{
    (e: 'update:scope', scope: SearchScope): void;
}>();

// Die Gruppe ist `prevent-deselect`, kann also nicht leer werden; getippt wird
// hier trotzdem gegen den allgemeinen Typ von reka-ui, nicht darauf vertraut.
function onUpdate(value: AcceptableValue | AcceptableValue[] | undefined) {
    if (value === 'titel' || value === 'text') emit('update:scope', value);
}
</script>
