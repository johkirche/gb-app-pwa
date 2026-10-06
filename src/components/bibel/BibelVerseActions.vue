<template>
    <!-- The action sheet: the app's bottom drawer, pulled down — or closed
         with the ✕ — to let go of the verses. Non-modal: no overlay, and the
         text above still scrolls and takes taps, so further verses can be
         added while it is open. One large row per action, its word spelt out:
         nothing hidden, nothing small to aim at. -->
    <Drawer :open="open" :modal="false" @update:open="onOpenChange">
        <DrawerContent non-modal class="max-h-[65dvh]">
            <div class="mx-auto w-full max-w-[36rem] px-3">
                <div class="flex items-center gap-2 border-b border-border pb-2 pl-2">
                    <div class="min-w-0 flex-1">
                        <DrawerTitle class="truncate text-[15px] font-medium" aria-live="polite">
                            {{ label }}
                        </DrawerTitle>
                        <DrawerDescription class="text-xs text-muted-foreground">
                            Weitere Verse antippen
                        </DrawerDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Auswahl aufheben"
                        @click="selection.clear()"
                    >
                        <X class="!size-5" aria-hidden="true" />
                    </Button>
                </div>

                <!-- The drawer scrolls on a short screen, so the text keeps its share. -->
                <ul class="py-1">
                    <li>
                        <button type="button" :class="ROW" @click="copy">
                            <Copy :class="ICON" aria-hidden="true" />
                            Kopieren
                        </button>
                    </li>
                    <li>
                        <button type="button" :class="ROW" @click="share">
                            <Share2 :class="ICON" aria-hidden="true" />
                            Teilen
                        </button>
                    </li>

                    <!-- Marking: the four colours right in the row, and a way back
                     to none. The ring is on the colour the whole selection
                     already wears, if it wears one. -->
                    <li
                        v-if="features.notizen"
                        :class="[ROW, 'cursor-default hover:bg-transparent']"
                    >
                        <Highlighter :class="ICON" aria-hidden="true" />
                        <span class="mr-auto">Markieren</span>
                        <span class="flex items-center gap-2" role="group" aria-label="Farbe">
                            <button
                                v-for="color in COLORS"
                                :key="color.key"
                                type="button"
                                class="size-8 rounded-full border border-border transition-transform active:scale-95"
                                :class="{
                                    'ring-2 ring-primary ring-offset-2 ring-offset-background':
                                        current === color.key,
                                }"
                                :style="{ background: `var(--bibel-mark-${color.key})` }"
                                :aria-label="color.label"
                                :aria-pressed="current === color.key"
                                @click="mark(color.key)"
                            />
                            <button
                                v-if="current"
                                type="button"
                                class="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted active:scale-95"
                                aria-label="Markierung entfernen"
                                @click="mark(null)"
                            >
                                <Eraser class="size-4" aria-hidden="true" />
                            </button>
                        </span>
                    </li>
                    <li v-if="features.notizen">
                        <button type="button" :class="ROW" @click="note">
                            <NotebookPen :class="ICON" aria-hidden="true" />
                            Notiz schreiben
                        </button>
                    </li>
                    <li v-if="features.lesezeichen">
                        <button type="button" :class="ROW" @click="bookmark">
                            <Bookmark :class="ICON" aria-hidden="true" />
                            Lesezeichen setzen
                        </button>
                    </li>
                    <li>
                        <button type="button" :class="ROW" @click="toService">
                            <Church :class="ICON" aria-hidden="true" />
                            Zum Gottesdienst
                        </button>
                    </li>
                    <!-- A playlist is chosen, not just added to. -->
                    <li v-if="playlistsStore.sortedPlaylists.length">
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <button type="button" :class="ROW">
                                    <ListMusic :class="ICON" aria-hidden="true" />
                                    Zu einer Playlist …
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                align="start"
                                class="max-h-72 w-60 overflow-y-auto"
                            >
                                <DropdownMenuItem
                                    v-for="playlist in playlistsStore.sortedPlaylists"
                                    :key="playlist.id"
                                    @select="toPlaylist(playlist.id, playlist.name)"
                                >
                                    <span aria-hidden="true">{{ playlist.emoji }}</span>
                                    <span class="truncate">{{ playlist.name }}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </li>
                </ul>
            </div>
        </DrawerContent>
    </Drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    Bookmark,
    Church,
    Copy,
    Eraser,
    Highlighter,
    ListMusic,
    NotebookPen,
    Share2,
    X,
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-sonner';

import { useLesezeichenStore } from '@/stores/lesezeichen';
import { useMarkierungenStore } from '@/stores/markierungen';
import { usePlaylistsStore } from '@/stores/playlists';
import { usePreferencesStore } from '@/stores/preferences';
import { useServiceStore } from '@/stores/service';

import { useVerseSelection } from '@/composables/useVerseSelection';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { BibelPassage, MarkierungsFarbe } from '@/db';
import { verseRefLabel } from '@/utils/bibel';
import { snippet, verseText } from '@/utils/bibelLayout';
import { passagesFromVerses } from '@/utils/bibelPassage';
import { copyText, versesRefLabel } from '@/utils/bibelVerses';

import './bibel-marks.css';

/**
 * What the reader can do with the verses picked out in the text: copy and
 * share them as a quotation, highlight them, write a note, set a Lesezeichen,
 * and take them into the hymnal's own lists — a reading for the Gottesdienst,
 * passages in a playlist. Reads the chapter and the selection from
 * useVerseSelection, so the page mounts it with no props, after its scroller.
 */

/** One action's row: a full-width target, its word spelt out. */
const ROW =
    'flex w-full items-center gap-4 rounded-lg px-2 py-2.5 text-left text-[15px] transition-colors hover:bg-muted active:bg-muted';
const ICON = 'size-5 shrink-0 text-muted-foreground';

const COLORS: { key: MarkierungsFarbe; label: string }[] = [
    { key: 'gelb', label: 'Gelb' },
    { key: 'gruen', label: 'Grün' },
    { key: 'blau', label: 'Blau' },
    { key: 'rosa', label: 'Rosa' },
];

const selection = useVerseSelection();
const { here, verses } = selection;
const markierungen = useMarkierungenStore();
const lesezeichen = useLesezeichenStore();
const { bibelFeatures: features } = storeToRefs(usePreferencesStore());

const label = computed(() => (here.value ? versesRefLabel(here.value, verses.value) : ''));

/** Open while verses are picked out; pulled down, it lets go of them. */
const open = computed(() => !!here.value && verses.value.length > 0);

function onOpenChange(value: boolean) {
    if (!value) selection.clear();
}
const quote = computed(() =>
    here.value ? copyText(selection.laid.value, here.value, verses.value) : '',
);

/** The colour every selected verse wears, or null when they differ or wear none. */
const current = computed(() => {
    if (!here.value) return null;
    const { slug, chapter } = here.value;
    const colors = new Set(verses.value.map((v) => markierungen.colorOf(slug, chapter, v)));
    const [only] = colors;
    return colors.size === 1 && only ? only : null;
});

async function copy() {
    try {
        await navigator.clipboard.writeText(quote.value);
        toast.success(`Kopiert: ${label.value}`, { duration: 2000 });
        selection.clear();
    } catch (err) {
        console.error('Error copying the verses:', err);
        toast.error('Der Text konnte nicht kopiert werden.');
    }
}

async function share() {
    // Not every browser can share (desktop Firefox, for one): copying is the
    // nearest thing it can do.
    if (!navigator.share) {
        await copy();
        return;
    }
    try {
        await navigator.share({ text: quote.value });
        selection.clear();
    } catch (err) {
        // The reader closing the share sheet is no failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error sharing the verses:', err);
        await copy();
    }
}

async function mark(color: MarkierungsFarbe | null) {
    if (!here.value) return;
    const { slug, chapter } = here.value;
    try {
        await markierungen.setColor(slug, chapter, verses.value, color);
        selection.clear();
    } catch (err) {
        console.error('Error saving the Markierung:', err);
        toast.error('Die Markierung konnte nicht gespeichert werden.');
    }
}

function note() {
    const [first] = verses.value;
    selection.clear();
    selection.openNote(first);
}

// --- Into the Gottesdienst and the playlists ---------------------------------

const serviceStore = useServiceStore();
const playlistsStore = usePlaylistsStore();

/** The selection as passages: one per unbroken run of verses. */
const passages = computed<BibelPassage[]>(() =>
    here.value ? passagesFromVerses(here.value, verses.value) : [],
);

async function toService() {
    try {
        for (const passage of passages.value) await serviceStore.addLesung(passage);
        toast.success(`Als Lesung vorgemerkt: ${label.value}`, { duration: 2000 });
        selection.clear();
    } catch (err) {
        console.error('Error adding the reading:', err);
        toast.error('Die Lesung konnte nicht gespeichert werden.');
    }
}

async function toPlaylist(id: string, name: string) {
    try {
        await playlistsStore.addPassagesToPlaylist(id, passages.value);
        toast.success(`${label.value} zu „${name}“ hinzugefügt`, { duration: 2000 });
        selection.clear();
    } catch (err) {
        console.error('Error adding the passage to the playlist:', err);
        toast.error('Die Bibelstelle konnte nicht gespeichert werden.');
    }
}

async function bookmark() {
    if (!here.value) return;
    const { slug, chapter } = here.value;
    const [first] = verses.value;
    try {
        await lesezeichen.add(
            slug,
            chapter,
            first,
            snippet(verseText(selection.laid.value, first)),
        );
        toast.success(`Lesezeichen gesetzt: ${verseRefLabel(here.value, first)}`, {
            duration: 2000,
        });
        selection.clear();
    } catch (err) {
        console.error('Error saving the Lesezeichen:', err);
        toast.error('Das Lesezeichen konnte nicht gespeichert werden.');
    }
}
</script>
