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

        <!-- Ausgabe auf ein angeschlossenes Instrument. Standardmäßig aus, und
             das mit Absicht: der erste MIDI-Zugriff löst eine Berechtigungs-
             abfrage aus, die niemand ungefragt sehen soll. -->
        <div class="px-2 py-3">
            <div class="flex items-center justify-between gap-4">
                <div class="flex min-w-0 items-center gap-4">
                    <Piano class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div class="min-w-0">
                        <Label for="settings-midi-output" class="text-[15px] font-normal">
                            MIDI-Ausgabe
                        </Label>
                        <p class="text-sm text-muted-foreground">
                            Lieder auf einem angeschlossenen Keyboard oder Orgelmodul spielen
                        </p>
                    </div>
                </div>
                <Switch
                    id="settings-midi-output"
                    :model-value="midiEnabled"
                    @update:model-value="onToggleMidi"
                />
            </div>

            <div v-if="midiEnabled" class="mt-4 pl-9">
                <!-- Safari kennt die Web-MIDI-Schnittstelle in keiner Version,
                     weder am Mac noch auf iPhone und iPad. Das gehört gesagt,
                     bevor jemand ein Kabel sucht. -->
                <p
                    v-if="!midi.isSupported"
                    class="flex items-start gap-2 text-sm text-muted-foreground"
                >
                    <AlertCircle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                        Dieser Browser kann keine MIDI-Geräte ansprechen. Auf iPhone und iPad ist
                        das grundsätzlich nicht möglich; am Rechner und unter Android geht es mit
                        Chrome, Edge oder Firefox.
                    </span>
                </p>

                <!-- Erst hier wird gefragt: die Berechtigung hängt an dieser
                     Schaltfläche, nicht am Start der App. -->
                <div v-else-if="!hasAccess" class="space-y-2">
                    <p class="text-sm text-muted-foreground">
                        Für die Geräteliste fragt der Browser einmalig nach Erlaubnis.
                    </p>
                    <Button variant="outline" size="sm" @click="onRequestAccess">
                        MIDI-Zugriff erlauben
                    </Button>
                    <p v-if="accessError" class="text-sm text-destructive">{{ accessError }}</p>
                </div>

                <p v-else-if="!devices.length" class="text-sm text-muted-foreground">
                    Kein Gerät gefunden. Schließen Sie ein Instrument an — die Liste aktualisiert
                    sich von allein.
                </p>

                <div v-else class="flex items-center justify-between gap-4">
                    <Label for="settings-midi-device" class="text-[15px] font-normal">Gerät</Label>
                    <Select :model-value="selectedDevice" @update:model-value="onSelectDevice">
                        <SelectTrigger id="settings-midi-device" class="h-9 w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="device in devices"
                                :key="device.id"
                                :value="device.id"
                            >
                                {{ deviceLabel(device) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    </SettingsList>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { AlertCircle, Highlighter, Piano, SeparatorVertical } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';

import { usePreferencesStore } from '@/stores/preferences';

import { type MidiOutputInfo, useMidiOutput } from '@/composables/useMidiOutput';

import SettingsList from '@/components/settings/SettingsList.vue';
import SongPlaybackPreview from '@/components/songview/SongPlaybackPreview.vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const preferencesStore = usePreferencesStore();

// Both marks live with the other MusicXML settings, so the song page picks them
// up through the same store.
const playbackMarks = computed(() => preferencesStore.xmlSettings);

function setPlaybackMark(key: 'highlightNotes' | 'showPlayhead', value: boolean) {
    preferencesStore.setXmlSetting(key, value);
}

const midi = useMidiOutput();
const devices = computed(() => midi.outputs.value);
const hasAccess = computed(() => midi.hasAccess.value);
const accessError = computed(() => midi.accessError.value);
const midiEnabled = computed(() => preferencesStore.midiOutputEnabled);

// With nothing chosen and one instrument connected, that one is what plays —
// the picker says so rather than standing empty.
const selectedDevice = computed(
    () => preferencesStore.midiOutputId || (devices.value.length === 1 ? devices.value[0].id : ''),
);

// Reading the permission never prompts, so it is safe on mount. It decides
// whether this section offers a device list or a request button.
onMounted(() => {
    void midi.readMidiPermission();
});

async function onToggleMidi(enabled: boolean) {
    await preferencesStore.setMidiOutputEnabled(enabled);
    // This tap is the user gesture the permission prompt needs. Asking here —
    // and nowhere else — keeps it out of the middle of a service.
    if (enabled && midi.isSupported) await midi.requestMidiAccess();
}

async function onRequestAccess() {
    await midi.requestMidiAccess();
}

function onSelectDevice(value: AcceptableValue) {
    if (typeof value === 'string') preferencesStore.setMidiOutputId(value);
}

function deviceLabel(device: MidiOutputInfo): string {
    return device.manufacturer ? `${device.name} (${device.manufacturer})` : device.name;
}
</script>
