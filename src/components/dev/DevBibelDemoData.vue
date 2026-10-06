<template>
    <!-- Development only (mounted behind import.meta.env.DEV, so a production
         build drops it): fill the Bible with a reader's worth of marks to see
         the views full, and empty it again to see them bare. -->
    <section class="mt-6 rounded-lg border border-dashed border-gold/60 px-3 py-3">
        <p class="label-micro text-gold">Demodaten (nur Entwicklung)</p>
        <p class="mt-1 text-sm text-muted-foreground">
            Lesezeichen, Markierungen, Notizen, gelesene Kapitel, ein laufender Leseplan und
            „Weiterlesen“ — wie bei jemandem, der die Bibel-Funktionen eine Weile benutzt.
            Lesefortschritt und Leseplan erscheinen nur, wenn die Funktion oben eingeschaltet ist.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
            <Button size="sm" :disabled="busy" @click="seed">Demodaten einfüllen</Button>
            <Button size="sm" variant="outline" :disabled="busy" @click="clear">
                Alles leeren
            </Button>
        </div>
        <p v-if="status" class="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {{ status }}
        </p>
    </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';
import { useLeseplanStore } from '@/stores/leseplan';
import { useLesezeichenStore } from '@/stores/lesezeichen';
import { useMarkierungenStore } from '@/stores/markierungen';
import { useNotizenStore } from '@/stores/notizen';

import { Button } from '@/components/ui/button';

import { type MarkierungsFarbe, db } from '@/db';
import { loadBook, setLastRead } from '@/utils/bibel';
import { layoutChapter, snippet, verseText } from '@/utils/bibelLayout';

const lesezeichen = useLesezeichenStore();
const markierungen = useMarkierungenStore();
const notizen = useNotizenStore();
const fortschritt = useBibelFortschrittStore();
const leseplan = useLeseplanStore();

const busy = ref(false);
const status = ref('');

const BOOKMARKS: [string, number, number][] = [
    ['psalm', 23, 4],
    ['johannes', 3, 16],
    ['roemer', 8, 28],
    ['jesaja', 40, 31],
    ['matthaeus', 11, 28],
    ['philipper', 4, 13],
    ['psalm', 121, 1],
    ['1-korinther', 13, 4],
];

const HIGHLIGHTS: [string, number, number[], MarkierungsFarbe][] = [
    ['psalm', 23, [1, 2, 3], 'gelb'],
    ['johannes', 3, [16], 'gelb'],
    ['jesaja', 41, [10], 'gruen'],
    ['roemer', 12, [12], 'blau'],
    ['matthaeus', 5, [3, 4, 5, 6, 7, 8, 9], 'rosa'],
    ['psalm', 46, [2], 'gruen'],
    ['johannes', 14, [6], 'blau'],
    ['klagelieder', 3, [22, 23], 'gelb'],
];

const NOTES: [string, number, number, string][] = [
    ['psalm', 23, 4, 'Trost im finstern Tal – gelesen bei der Beerdigung von Oma.'],
    ['johannes', 3, 16, 'Mein Konfirmationsspruch.'],
    ['jesaja', 40, 31, 'Für die Andacht am Erntedankfest vormerken.'],
    ['roemer', 8, 28, 'Passt zu Lied 211 – im Gottesdienst zusammen singen?'],
    ['matthaeus', 5, 9, 'Friedensgebet in der Gemeinde.'],
];

/** Chapters marked read: one book through, the start of two more. */
const READ: [string, number, number][] = [
    ['markus', 1, 16],
    ['psalm', 1, 40],
    ['1-mose', 1, 12],
];

async function seed() {
    busy.value = true;
    status.value = 'Wird eingefüllt …';
    try {
        for (const [slug, chapter, verse] of BOOKMARKS) {
            const chapters = await loadBook(slug);
            const text = verseText(layoutChapter(chapters[chapter - 1] ?? []), verse);
            await lesezeichen.add(slug, chapter, verse, snippet(text));
        }
        for (const [slug, chapter, verses, color] of HIGHLIGHTS) {
            await markierungen.setColor(slug, chapter, verses, color);
        }
        for (const [slug, chapter, verse, text] of NOTES) {
            await notizen.save(slug, chapter, verse, text);
        }
        for (const [slug, from, to] of READ) {
            for (let chapter = from; chapter <= to; chapter++) {
                await fortschritt.markRead(slug, chapter);
            }
        }

        // "Die Psalmen in 30 Tagen", begun eleven days ago: today is day 12,
        // eight days ticked off — so the tab also has some catching up to show.
        const started = new Date();
        started.setDate(started.getDate() - 11);
        await leseplan.start('psalmen-30', started);
        for (let day = 1; day <= 8; day++) await leseplan.setDayDone(day, true);

        await setLastRead({ slug: 'psalm', chapter: 41 });
        status.value = 'Fertig. Bibel-Reiter und ein Kapitel ansehen (z. B. Psalm 23).';
    } catch (err) {
        console.error('Seeding the demo data failed:', err);
        status.value = 'Fehlgeschlagen – siehe Konsole (offline? die Bibelbücher werden geladen).';
    } finally {
        busy.value = false;
    }
}

async function clear() {
    busy.value = true;
    try {
        await lesezeichen.clearAll(); // also forgets "Weiterlesen"
        await markierungen.clearAll();
        await notizen.clearAll();
        await leseplan.stop();
        await db.gelesen.clear();
        await fortschritt.load();
        status.value = 'Geleert.';
    } catch (err) {
        console.error('Clearing the demo data failed:', err);
        status.value = 'Fehlgeschlagen – siehe Konsole.';
    } finally {
        busy.value = false;
    }
}
</script>
