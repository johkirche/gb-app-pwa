<template>
    <!-- Docked under the text while verses are picked out, the way the song
         page docks its transport: opaque, above the safe area, and taking its
         room from the scroller rather than covering the last lines. -->
    <footer
        v-if="here && verses.length"
        class="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
        aria-label="Verse"
    >
        <div class="mx-auto max-w-[36rem] px-3 pb-1.5 pt-2">
            <div class="flex items-center gap-2 pl-1">
                <p class="min-w-0 flex-1 truncate text-sm font-medium" aria-live="polite">
                    {{ label }}
                </p>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Auswahl aufheben"
                    @click="selection.clear()"
                >
                    <X aria-hidden="true" />
                </Button>
            </div>

            <!-- The four colours and a way back to none. The ring is on the
                 colour the whole selection already wears, if it wears one. -->
            <div
                v-if="colorsOpen && features.notizen"
                class="flex items-center justify-center gap-3 pb-1 pt-2"
                role="group"
                aria-label="Farbe"
            >
                <button
                    v-for="color in COLORS"
                    :key="color.key"
                    type="button"
                    class="size-9 rounded-full border border-border transition-transform active:scale-95"
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
                    type="button"
                    class="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted active:scale-95"
                    aria-label="Markierung entfernen"
                    @click="mark(null)"
                >
                    <Eraser class="size-4" aria-hidden="true" />
                </button>
            </div>

            <!-- Five equal places, always all in view: past five actions the
                 fifth becomes "Mehr" (see verseActions.ts). What is switched
                 off under Einstellungen → Bibel is not in the list at all. -->
            <div class="flex items-stretch gap-1 pt-1">
                <template v-for="action in bar.inBar" :key="action.key">
                    <!-- A playlist is chosen, not just added to. -->
                    <DropdownMenu v-if="action.key === 'playlist'">
                        <DropdownMenuTrigger as-child>
                            <BibelVerseAction :icon="action.icon" :label="action.label" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="top"
                            align="end"
                            class="max-h-72 w-56 overflow-y-auto"
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
                    <BibelVerseAction
                        v-else
                        :icon="action.icon"
                        :label="action.label"
                        :aria-expanded="action.key === 'markieren' ? colorsOpen : undefined"
                        @click="action.run()"
                    />
                </template>

                <DropdownMenu v-if="bar.more.length">
                    <DropdownMenuTrigger as-child>
                        <BibelVerseAction :icon="Ellipsis" label="Mehr" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side="top"
                        align="end"
                        class="max-h-80 w-56 overflow-y-auto"
                    >
                        <DropdownMenuItem
                            v-for="action in moreActions"
                            :key="action.key"
                            @select="action.run()"
                        >
                            <component :is="action.icon" aria-hidden="true" />
                            {{ action.label }}
                        </DropdownMenuItem>
                        <template v-if="playlistInMore">
                            <DropdownMenuSeparator v-if="moreActions.length" />
                            <DropdownMenuLabel>Zur Playlist</DropdownMenuLabel>
                            <DropdownMenuItem
                                v-for="playlist in playlistsStore.sortedPlaylists"
                                :key="playlist.id"
                                @select="toPlaylist(playlist.id, playlist.name)"
                            >
                                <span aria-hidden="true">{{ playlist.emoji }}</span>
                                <span class="truncate">{{ playlist.name }}</span>
                            </DropdownMenuItem>
                        </template>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    </footer>
</template>

<script setup lang="ts">
import { type Component, computed, ref, watch } from 'vue';

import {
    Bookmark,
    Church,
    Copy,
    Ellipsis,
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

import BibelVerseAction from '@/components/bibel/BibelVerseAction.vue';
import { fitActions } from '@/components/bibel/verseActions';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
const quote = computed(() =>
    here.value ? copyText(selection.laid.value, here.value, verses.value) : '',
);

const colorsOpen = ref(false);
// The colour row folds away with the selection it was for.
watch(
    () => verses.value.length,
    (count) => {
        if (count === 0) colorsOpen.value = false;
    },
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

// --- The actions, in the order they earn a place in the bar ------------------

interface VerseAction {
    key: string;
    label: string;
    icon: Component;
    run: () => void;
}

const actions = computed<VerseAction[]>(() => [
    { key: 'kopieren', label: 'Kopieren', icon: Copy, run: copy },
    { key: 'teilen', label: 'Teilen', icon: Share2, run: share },
    ...(features.value.notizen
        ? [
              {
                  key: 'markieren',
                  label: 'Markieren',
                  icon: Highlighter,
                  run: () => (colorsOpen.value = !colorsOpen.value),
              },
              { key: 'notiz', label: 'Notiz', icon: NotebookPen, run: note },
          ]
        : []),
    ...(features.value.lesezeichen
        ? [{ key: 'lesezeichen', label: 'Lesezeichen', icon: Bookmark, run: bookmark }]
        : []),
    { key: 'gottesdienst', label: 'Gottesdienst', icon: Church, run: toService },
    // Only with a playlist to choose; it opens a menu, so run does nothing.
    ...(playlistsStore.sortedPlaylists.length
        ? [{ key: 'playlist', label: 'Playlist', icon: ListMusic, run: () => {} }]
        : []),
]);

const bar = computed(() => fitActions(actions.value));
const moreActions = computed(() => bar.value.more.filter((action) => action.key !== 'playlist'));
const playlistInMore = computed(() => bar.value.more.some((action) => action.key === 'playlist'));

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
