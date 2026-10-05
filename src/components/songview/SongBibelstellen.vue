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

        <!-- One disclosure per passage: the reference and what the song takes
             from it read at a glance, the wording opens on a tap. Native
             details/summary, so keyboard and screen readers get it for free. -->
        <details v-for="stelle in stellen" :key="stelle.ref" class="group mb-2">
            <summary
                class="flex cursor-pointer list-none items-start gap-2 rounded-md py-1 [&::-webkit-details-marker]:hidden"
            >
                <ChevronRight
                    class="mt-0.5 size-[18px] shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    aria-hidden="true"
                />
                <span class="min-w-0">
                    <span class="text-foreground">{{ stelle.ref }}</span>
                    <span v-if="stelle.note" class="block text-sm text-muted-foreground">
                        {{ stelle.note }}
                    </span>
                </span>
            </summary>

            <blockquote
                class="ml-[26px] mt-2 border-l-2 border-gold/40 pl-3 text-[15px] leading-relaxed"
            >
                <template v-if="stelle.verses">
                    <span v-for="(vers, idx) in stelle.verses" :key="idx">
                        <!-- v-text, so the template's line breaks do not end
                             up as spaces inside the verse number. -->
                        <sup
                            class="text-[0.7em] text-muted-foreground"
                            v-text="verseLabel(stelle.verses, idx)"
                        />
                        {{ vers[2] }}{{ ' ' }}
                    </span>
                </template>
                <span v-else class="italic text-muted-foreground">
                    Zu lang, um sie hier wiederzugeben.
                </span>
            </blockquote>

            <RouterLink
                :to="chapterPath({ slug: stelle.at[0], chapter: stelle.at[1] }, stelle.at[2])"
                class="ml-[26px] mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground underline decoration-dotted underline-offset-[3px] transition-colors hover:text-primary active:text-primary"
            >
                Im Zusammenhang lesen
            </RouterLink>
        </details>

        <p class="mt-3 text-xs text-muted-foreground">{{ translation }} · automatisch zugeordnet</p>
    </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import { ChevronRight } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import type { Song } from '@/db';
import { chapterPath } from '@/utils/bibel';
import {
    type Bibelstelle,
    bibelstellenFor,
    loadBibelstellen,
    verseLabel,
} from '@/utils/bibelstellen';

const props = defineProps<{
    song: Song;
}>();

const stellen = ref<Bibelstelle[]>([]);
const translation = ref('');

watch(
    () => props.song,
    async (song) => {
        stellen.value = [];
        try {
            const data = await loadBibelstellen();
            // Another song may have been opened while the data was loading.
            if (song !== props.song) return;
            stellen.value = bibelstellenFor(data, song);
            translation.value = data.translation;
        } catch (err) {
            // A section that cannot load simply is not shown — the song is
            // whole without it.
            console.error('Error loading Bibelstellen:', err);
        }
    },
    { immediate: true },
);
</script>
