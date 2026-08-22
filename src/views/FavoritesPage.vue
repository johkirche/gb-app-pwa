<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Favoriten">
            <template #leading>
                <BackButton default-href="/tabs/playlisten" />
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col pb-8">
                <!-- Empty state -->
                <div
                    v-if="favoritedSongs.length === 0"
                    class="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center"
                >
                    <Heart
                        class="size-14 text-muted-foreground"
                        stroke-width="1.25"
                        aria-hidden="true"
                    />
                    <h2 class="mt-4 font-display text-2xl font-semibold">Keine Favoriten</h2>
                    <p class="mt-2 max-w-96 text-sm text-muted-foreground">
                        Tippen Sie auf das Herz-Symbol in einem Lied, um es zu Ihren Favoriten
                        hinzuzufügen.
                    </p>
                    <Button variant="outline" class="mt-6" @click="router.push('/tabs/lieder')">
                        Lieder durchsuchen
                    </Button>
                </div>

                <!-- Favorites list -->
                <ul v-else class="mt-2 divide-y divide-border">
                    <li
                        v-for="song in favoritedSongs"
                        :key="song.id"
                        class="relative flex items-center gap-1 transition-colors hover:bg-muted"
                    >
                        <!-- Stretched-link row: the after-overlay makes the whole row
                             (chevron included) navigate; the heart sits above it. -->
                        <button
                            type="button"
                            class="min-w-0 flex-1 rounded-sm py-3 pl-2 text-left after:absolute after:inset-0 after:content-['']"
                            @click="navigateToSong(song.id)"
                        >
                            <span class="block break-words font-display text-[17px] leading-snug">
                                <span v-if="song.index" class="number-display mr-0.5 text-lg">
                                    {{ song.index }}.
                                </span>
                                <span>{{ song.titel }}</span>
                            </span>
                            <span
                                v-if="formatCategories(song.kategorien)"
                                class="mt-0.5 block text-sm text-muted-foreground"
                            >
                                {{ formatCategories(song.kategorien) }}
                            </span>
                        </button>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="relative z-10 shrink-0 text-destructive hover:text-destructive"
                            :aria-label="`${song.titel} aus Favoriten entfernen`"
                            @click.stop="removeFavorite(song.id)"
                        >
                            <Heart class="!size-5" fill="currentColor" aria-hidden="true" />
                        </Button>
                        <ChevronRight
                            class="mr-1 size-4 shrink-0 text-muted-foreground/70"
                            aria-hidden="true"
                        />
                    </li>
                </ul>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ChevronRight, Heart } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { useFavoritesStore } from '@/stores/favorites';
import { useSongsStore } from '@/stores/songs';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';

import type { Category } from '@/db';

const router = useRouter();
const songsStore = useSongsStore();
const favoritesStore = useFavoritesStore();

// Favorited songs, in the order they were added (newest first)
const favoritedSongs = computed(() => {
    const songById = new Map(songsStore.songs.map((s) => [s.id, s]));
    return favoritesStore.sortedFavorites
        .map((f) => songById.get(f.id))
        .filter((s): s is NonNullable<typeof s> => !!s);
});

function navigateToSong(id: string) {
    router.push(`/songs/${id}`);
}

function removeFavorite(id: string) {
    favoritesStore.removeFavorite(id);
}

function formatCategories(categories: Category[]): string {
    return categories
        .map((c) => c.name?.trim())
        .filter((name): name is string => !!name)
        .join(', ');
}
</script>
