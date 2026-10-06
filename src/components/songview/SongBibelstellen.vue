<template>
    <!-- Below the credits, on the same measure: the passages are a reference to
         look up, not part of the song, so they come after everything the book
         itself prints. -->
    <section
        v-if="stellen.length > 0"
        class="verse-col mt-6 border-t border-border pt-6"
        aria-labelledby="bibelstellen-heading"
    >
        <h2 id="bibelstellen-heading" class="label-micro mb-3 text-muted-foreground">
            Bibelstellen
        </h2>

        <!-- First the passages the song takes up in a line of its own, in
             strophe order and with that line; then those that speak to the
             song as a whole. -->
        <template v-for="group in groups" :key="group.key">
            <h3
                v-if="group.heading"
                class="mb-2 mt-4 text-xs font-medium text-muted-foreground"
                v-text="group.heading"
            />
            <!-- One disclosure per passage: the reference and what the song takes
                 from it read at a glance, the wording opens on a tap. Native
                 details/summary, so keyboard and screen readers get it for free. -->
            <details v-for="stelle in group.items" :key="stelle.ref" class="group mb-2">
                <summary
                    class="flex cursor-pointer list-none items-start gap-2 rounded-md py-1 [&::-webkit-details-marker]:hidden"
                >
                    <ChevronRight
                        class="mt-0.5 size-[1.125rem] shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                        aria-hidden="true"
                    />
                    <span class="min-w-0">
                        <span class="text-foreground">{{ stelle.ref }}</span>
                        <!-- The song's own words, set as its verses are. -->
                        <span v-if="stelle.line" class="mt-0.5 block text-sm">
                            <span class="text-muted-foreground">
                                Strophe {{ stelle.line.strophe }}:
                            </span>
                            <span class="font-hymnal">„{{ stelle.line.text }}“</span>
                        </span>
                        <span v-if="stelle.note" class="block text-sm text-muted-foreground">
                            {{ stelle.note }}
                        </span>
                    </span>
                </summary>

                <blockquote
                    class="ml-[26px] mt-2 border-l-2 border-gold/40 pl-3 text-[0.9375rem] leading-relaxed"
                >
                    <template v-if="wording.get(stelle.ref)?.length">
                        <span v-for="(vers, idx) in wording.get(stelle.ref)" :key="idx">
                            <!-- v-text, so the template's line breaks do not end
                                 up as spaces inside the verse number. -->
                            <sup
                                class="text-[0.7em] text-muted-foreground"
                                v-text="verseLabel(wording.get(stelle.ref)!, idx)"
                            />
                            {{ vers[2] }}{{ ' ' }}
                        </span>
                    </template>
                    <span v-else class="italic text-muted-foreground">
                        {{ wordingNote(stelle) }}
                    </span>
                </blockquote>

                <RouterLink
                    :to="chapterPath({ slug: stelle.at[0], chapter: stelle.at[1] }, stelle.at[2])"
                    class="ml-[26px] mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground underline decoration-dotted underline-offset-[3px] transition-colors hover:text-primary active:text-primary"
                >
                    Im Zusammenhang lesen
                </RouterLink>
            </details>
        </template>

        <p class="mt-3 text-xs text-muted-foreground">
            {{ BIBEL_TRANSLATIONS[bibelTranslation].label }} · automatisch zugeordnet
        </p>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { ChevronRight } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';

import { usePreferencesStore } from '@/stores/preferences';

import type { Song } from '@/db';
import { BIBEL_TRANSLATIONS, type Block, chapterPath, loadBook } from '@/utils/bibel';
import {
    type BibelVers,
    type Bibelstelle,
    bibelstellen,
    bibelstellenFor,
    groupByLine,
    loadBibelstellen,
    stelleVerses,
    verseLabel,
} from '@/utils/bibelstellen';

const props = defineProps<{
    song: Song;
}>();

const { bibelTranslation } = storeToRefs(usePreferencesStore());

// The file comes with the sync and may not be on the device at all; nothing
// is shown then.
loadBibelstellen().catch((err: unknown) => console.error('Error loading Bibelstellen:', err));

const stellen = computed<Bibelstelle[]>(() =>
    bibelstellen.value ? bibelstellenFor(bibelstellen.value, props.song) : [],
);

const groups = computed(() => {
    const { toLines, whole } = groupByLine(stellen.value);
    return [
        { key: 'lines', heading: '', items: toLines },
        // A heading only where it sets these apart from passages with a line.
        { key: 'whole', heading: toLines.length ? 'Zum ganzen Lied' : '', items: whole },
    ].filter((group) => group.items.length > 0);
});

// --- The wording, from the Bible on the device -------------------------------
//
// In the translation the reader reads. A whole chapter or a long range is
// named, not quoted; a book the device has not got (offline, never opened)
// says so rather than stay blank.

const MAX_VERSES = 30;

const wording = ref(new Map<string, BibelVers[]>());
const unavailable = ref(new Set<string>());

function wordingNote(stelle: Bibelstelle): string {
    if (unavailable.value.has(stelle.ref)) {
        return 'Der Bibeltext ist offline noch nicht auf dem Gerät.';
    }
    if (wording.value.has(stelle.ref)) return 'Zu lang, um sie hier wiederzugeben.';
    return '…';
}

watch(
    () => [stellen.value, bibelTranslation.value] as const,
    async ([current, translation]) => {
        wording.value = new Map();
        unavailable.value = new Set();
        const books = new Map<string, Promise<Block[][] | null>>();
        const found = new Map<string, BibelVers[]>();
        const missing = new Set<string>();
        await Promise.all(
            current.map(async (stelle) => {
                const slug = stelle.at[0];
                if (!books.has(slug)) {
                    books.set(
                        slug,
                        loadBook(slug, translation).catch(() => null),
                    );
                }
                const chapters = await books.get(slug)!;
                if (!chapters) {
                    missing.add(stelle.ref);
                    return;
                }
                const verses = stelleVerses(stelle, chapters);
                found.set(stelle.ref, verses.length <= MAX_VERSES ? verses : []);
            }),
        );
        // Another song, or the other translation, may have been asked for meanwhile.
        if (current !== stellen.value || translation !== bibelTranslation.value) return;
        wording.value = found;
        unavailable.value = missing;
    },
    { immediate: true },
);
</script>
