<template>
    <!-- What the engraving shows while a song plays. The preview above the
         switches answers to them, so what it shows is what the song page
         will do. -->
    <SettingsList>
        <div class="px-2 py-3">
            <div
                class="mx-auto w-full max-w-sm rounded-md border border-border bg-muted/40 px-3 py-2"
            >
                <SongPlaybackPreview
                    :highlight-notes="playbackMarks.highlightNotes"
                    :show-playhead="playbackMarks.showPlayhead"
                />
            </div>
            <p class="mt-3 text-center text-sm text-muted-foreground">
                Gilt für die MusicXML-Ansicht.
            </p>
        </div>

        <div class="flex items-center justify-between gap-4 px-2 py-3">
            <div class="flex min-w-0 items-center gap-4">
                <Highlighter class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0">
                    <Label for="settings-highlight-notes" class="text-[15px] font-normal">
                        Noten hervorheben
                    </Label>
                    <p class="text-sm text-muted-foreground">
                        Die klingende Note und ihre Silbe farbig
                    </p>
                </div>
            </div>
            <Switch
                id="settings-highlight-notes"
                :model-value="playbackMarks.highlightNotes"
                @update:model-value="setPlaybackMark('highlightNotes', $event)"
            />
        </div>

        <div class="flex items-center justify-between gap-4 px-2 py-3">
            <div class="flex min-w-0 items-center gap-4">
                <SeparatorVertical
                    class="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
                <div class="min-w-0">
                    <Label for="settings-show-playhead" class="text-[15px] font-normal">
                        Abspielbalken
                    </Label>
                    <p class="text-sm text-muted-foreground">
                        Ein Balken, der mit der Musik über das System läuft
                    </p>
                </div>
            </div>
            <Switch
                id="settings-show-playhead"
                :model-value="playbackMarks.showPlayhead"
                @update:model-value="setPlaybackMark('showPlayhead', $event)"
            />
        </div>
    </SettingsList>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Highlighter, SeparatorVertical } from 'lucide-vue-next';

import { usePreferencesStore } from '@/stores/preferences';

import SettingsList from '@/components/settings/SettingsList.vue';
import SongPlaybackPreview from '@/components/songview/SongPlaybackPreview.vue';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const preferencesStore = usePreferencesStore();

// Both marks live with the other MusicXML settings, so the song page picks them
// up through the same store.
const playbackMarks = computed(() => preferencesStore.xmlSettings);

function setPlaybackMark(key: 'highlightNotes' | 'showPlayhead', value: boolean) {
    preferencesStore.setXmlSetting(key, value);
}
</script>
