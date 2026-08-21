<template>
    <SettingsList>
        <button
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="router.push('/download')"
        >
            <CloudDownload class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0 flex-1">
                <p class="text-[15px]">Heruntergeladene Inhalte</p>
                <p class="text-sm text-muted-foreground">
                    {{ songsCount }} Lieder, {{ filesCount }} Dateien
                </p>
            </div>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>

        <!-- Always visible: null renders „Vom Browser nicht unterstützt."
             (matches the pre-migration behavior) -->
        <div class="flex items-center gap-4 px-2 py-3">
            <Server class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[15px]">Dauerhafte Speicherung</p>
                <p class="text-sm leading-relaxed text-muted-foreground">
                    {{ persistedStatusText }}
                </p>
            </div>
        </div>

        <button
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="handleExport"
        >
            <Download class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[15px]">Daten exportieren</p>
                <p class="text-sm text-muted-foreground">
                    Playlists und Favoriten als Datei sichern
                </p>
            </div>
        </button>

        <button
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="importInput?.click()"
        >
            <CloudUpload class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[15px]">Daten importieren</p>
                <p class="text-sm text-muted-foreground">
                    Aus einer Sicherungsdatei wiederherstellen
                </p>
            </div>
        </button>

        <button
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="router.push('/install-pwa')"
        >
            <Smartphone class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0 flex-1">
                <p class="text-[15px]">App installieren</p>
                <p class="text-sm text-muted-foreground">Installiere die App auf deinem Gerät</p>
            </div>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>

        <input
            ref="importInput"
            type="file"
            accept="application/json,.json"
            style="display: none"
            @change="onImportFileChange"
        />
    </SettingsList>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
    ChevronRight,
    CloudDownload,
    CloudUpload,
    Download,
    Server,
    Smartphone,
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useFavoritesStore } from '@/stores/favorites';
import { usePlaylistsStore } from '@/stores/playlists';
import { useSongsStore } from '@/stores/songs';

import SettingsList from '@/components/settings/SettingsList.vue';

import { type Favorite, type Playlist, db } from '@/db';
import { downloadJsonFile } from '@/services/storage';

// Both counts and the persistence state are volatile enough to need refreshing
// on every entry, which the settings shell already does for its overview — so
// they come down from there rather than being read a second time here.
const props = defineProps<{
    filesCount: number;
    /** true/false from the browser, null = unsupported */
    persistentStorage: boolean | null;
}>();

const router = useRouter();
const songsStore = useSongsStore();
const playlistsStore = usePlaylistsStore();
const favoritesStore = useFavoritesStore();

// Hidden file input for the backup import
const importInput = ref<HTMLInputElement | null>(null);

const songsCount = computed(() => songsStore.songs.length);

const persistedStatusText = computed(() => {
    if (props.persistentStorage === true) {
        return 'Aktiv – Ihre Daten sind vor automatischer Löschung geschützt.';
    }
    if (props.persistentStorage === false) {
        return 'Nicht aktiv – der Browser kann lokale Daten bei Speicherplatzmangel entfernen.';
    }
    return 'Vom Browser nicht unterstützt.';
});

function showToast(message: string, color: 'success' | 'danger') {
    if (color === 'success') {
        toast.success(message, { duration: 3000 });
    } else {
        toast.error(message, { duration: 3000 });
    }
}

async function handleExport() {
    try {
        const [playlists, favorites] = await Promise.all([
            db.playlists.toArray(),
            db.favorites.toArray(),
        ]);
        downloadJsonFile(`gesangbuch-daten-${new Date().toISOString().slice(0, 10)}.json`, {
            app: 'gesangbuch',
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            playlists,
            favorites,
        });
        showToast('Daten wurden exportiert.', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Die Daten konnten nicht exportiert werden.', 'danger');
    }
}

// Revive a JSON-serialized Date (ISO string) back into a real Date object
function reviveDate(value: unknown): Date {
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function onImportFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
        const data = JSON.parse(await file.text());
        if (
            data?.app !== 'gesangbuch' ||
            !Array.isArray(data.playlists) ||
            !Array.isArray(data.favorites)
        ) {
            throw new Error('invalid backup file');
        }

        const playlists: Playlist[] = data.playlists
            .filter(
                (p: unknown) =>
                    p &&
                    typeof (p as Playlist).id === 'string' &&
                    typeof (p as Playlist).name === 'string' &&
                    Array.isArray((p as Playlist).songIds),
            )
            .map((p: Playlist & { createdAt: string | Date; updatedAt: string | Date }) => ({
                id: p.id,
                name: p.name,
                emoji: typeof p.emoji === 'string' ? p.emoji : '🎵',
                songIds: p.songIds.filter((s: unknown): s is string => typeof s === 'string'),
                createdAt: reviveDate(p.createdAt),
                updatedAt: reviveDate(p.updatedAt),
            }));

        const favorites: Favorite[] = data.favorites
            .filter((f: unknown) => f && typeof (f as Favorite).id === 'string')
            .map((f: Favorite & { createdAt: string | Date }) => ({
                id: f.id,
                createdAt: reviveDate(f.createdAt),
            }));

        // bulkPut matches on the primary keys (playlist id = UUID, favorite id
        // = song id), so re-importing the same backup is idempotent — existing
        // rows are overwritten, never duplicated.
        await db.transaction('rw', db.playlists, db.favorites, async () => {
            await db.playlists.bulkPut(playlists);
            await db.favorites.bulkPut(favorites);
        });

        // Both stores hydrate their refs only once at creation — reload them
        await Promise.all([playlistsStore.loadPlaylists(), favoritesStore.loadFavorites()]);

        showToast(
            `${playlists.length} Playlists und ${favorites.length} Favoriten importiert.`,
            'success',
        );
    } catch (error) {
        console.error('Error importing data:', error);
        showToast(
            'Die Datei konnte nicht importiert werden. Bitte wählen Sie eine gültige Sicherungsdatei.',
            'danger',
        );
    }
}
</script>
