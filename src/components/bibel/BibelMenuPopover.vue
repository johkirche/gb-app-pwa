<template>
    <Popover v-model:open="menuOpen">
        <PopoverTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Einstellungen">
                <Settings class="!size-5" aria-hidden="true" />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            align="end"
            :collision-padding="12"
            class="w-80 p-0"
            aria-label="Einstellungen"
        >
            <div class="max-h-[70vh] overflow-y-auto p-3">
                <!-- Actions Group -->
                <p class="label-micro px-1 pb-2 pt-1 text-gold">Aktionen</p>

                <!-- The verse at the top of the screen is the one being read,
                     so that is where the Lesezeichen goes — the same mark a
                     tap on its number sets. -->
                <button
                    v-if="topVerse !== null"
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                    @click="onBookmark"
                >
                    <BookmarkMinus
                        v-if="topVerseMarked"
                        class="size-4 shrink-0 text-gold"
                        aria-hidden="true"
                    />
                    <BookmarkPlus
                        v-else
                        class="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    {{
                        topVerseMarked
                            ? `Lesezeichen bei Vers ${topVerse} entfernen`
                            : `Lesezeichen bei Vers ${topVerse}`
                    }}
                </button>
                <!-- What is already marked here, to go straight to. -->
                <div
                    v-if="chapterMarks.length"
                    class="flex flex-wrap items-center gap-1.5 px-1 pb-2 pt-1 text-sm text-muted-foreground"
                >
                    <Bookmark class="size-4 shrink-0 fill-current text-gold" aria-hidden="true" />
                    <span class="mr-0.5">In diesem Kapitel:</span>
                    <button
                        v-for="verse in chapterMarks"
                        :key="verse"
                        type="button"
                        class="number-display rounded-md border border-border px-2 py-0.5 text-foreground transition-colors hover:bg-muted active:bg-muted"
                        :aria-label="`Zu Vers ${verse}`"
                        @click="onGoto(verse)"
                    >
                        {{ verse }}
                    </button>
                </div>

                <!-- Hidden where the platform has no voice to read with. -->
                <button
                    v-if="canReadAloud"
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                    @click="onReadAloud"
                >
                    <Square
                        v-if="reading"
                        class="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Volume2
                        v-else
                        class="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    {{ reading ? 'Vorlesen beenden' : readAloudLabel }}
                </button>

                <!-- More actions on the chapter go here (the coordinator's
                     "Kapitel als gelesen markieren", for one). The slot gets
                     `close`, so an entry can put the menu away before it acts,
                     the way the entries above do. -->
                <slot name="actions" :close="close" />

                <!-- Display Settings Group -->
                <p class="label-micro mt-3 border-t border-border px-1 pb-2 pt-3 text-gold">
                    Anzeige
                </p>
                <div class="space-y-4 px-1 py-1">
                    <div class="space-y-3 pb-1">
                        <div class="flex items-baseline justify-between gap-3">
                            <span class="flex items-center gap-2.5 text-sm font-medium">
                                <Type
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                Textgröße
                            </span>
                            <span class="number-display text-lg leading-none">
                                {{ Math.round(scale * 100) }}%
                            </span>
                        </div>
                        <Slider
                            :model-value="[scale]"
                            :min="0.5"
                            :max="2"
                            :step="0.1"
                            aria-label="Textgröße"
                            @update:model-value="onScaleChange"
                        />
                    </div>
                    <div
                        v-for="item in switches"
                        :key="item.key"
                        class="flex items-center justify-between gap-3"
                    >
                        <Label :for="`bibel-${item.key}`" class="flex items-center gap-2.5">
                            <component
                                :is="item.icon"
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            {{ item.label }}
                        </Label>
                        <Switch
                            :id="`bibel-${item.key}`"
                            :model-value="display[item.key]"
                            @update:model-value="
                                $emit('update:display', { key: item.key, value: $event })
                            "
                        />
                    </div>
                    <!-- A second translation, verse by verse beside Menge. -->
                    <div class="flex items-center justify-between gap-3">
                        <Label for="bibel-parallel" class="flex items-center gap-2.5">
                            <Columns2
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Luther 1912 daneben
                        </Label>
                        <Switch
                            id="bibel-parallel"
                            :model-value="parallel === 'luther1912'"
                            @update:model-value="
                                $emit('update:parallel', $event ? 'luther1912' : null)
                            "
                        />
                    </div>
                    <!-- Hidden where the platform has no wake lock: a switch
                         that provably does nothing is worse than no switch.
                         It is the song page's setting too — one screen, one
                         answer to whether it may dim. -->
                    <div v-if="wakeLockSupported" class="flex items-center justify-between gap-3">
                        <Label for="bibel-keep-awake" class="flex items-center gap-2.5">
                            <Lightbulb
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Bildschirm anlassen
                        </Label>
                        <Switch
                            id="bibel-keep-awake"
                            :model-value="keepScreenAwake"
                            @update:model-value="$emit('update:keepScreenAwake', $event)"
                        />
                    </div>
                </div>
            </div>
        </PopoverContent>
    </Popover>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import {
    AlignJustify,
    Bookmark,
    BookmarkMinus,
    BookmarkPlus,
    Columns2,
    Hash,
    Heading,
    Lightbulb,
    MessageSquareText,
    Settings,
    Square,
    Type,
    Volume2,
} from 'lucide-vue-next';

import { isWakeLockSupported } from '@/composables/useWakeLock';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import type { BibelDisplaySettings, BibelParallel } from '@/db';

/**
 * The chapter page's menu: what can be done with the chapter, and how it is
 * set. Like the song page's menu it only reports; the page owns the chapter,
 * the reading position and the voice.
 */
const props = defineProps<{
    scale: number;
    display: BibelDisplaySettings;
    /** The translation set beside Menge, or null for Menge alone. */
    parallel: BibelParallel;
    keepScreenAwake: boolean;
    /** The verse at the top of the screen, asked for each time the menu opens. */
    topVerse: number | null;
    /** Whether that verse already carries a Lesezeichen. */
    topVerseMarked: boolean;
    /** The verses of this chapter that carry one, in order. */
    chapterMarks: number[];
    /** Whether the device can read aloud at all. */
    canReadAloud: boolean;
    /** Whether it is reading (or paused in) this chapter now. */
    reading: boolean;
}>();

const emit = defineEmits<{
    /** The menu was opened: time to find the verse at the top. */
    opened: [];
    'update:scale': [value: number];
    'update:display': [
        payload: {
            key: keyof BibelDisplaySettings;
            value: BibelDisplaySettings[keyof BibelDisplaySettings];
        },
    ];
    'update:parallel': [value: BibelParallel];
    'update:keepScreenAwake': [value: boolean];
    bookmark: [];
    goto: [verse: number];
    readAloud: [];
    stopReading: [];
}>();

const switches: {
    key: keyof BibelDisplaySettings;
    label: string;
    icon: typeof Heading;
}[] = [
    { key: 'showHeadings', label: 'Überschriften', icon: Heading },
    { key: 'showVerseNumbers', label: 'Versnummern', icon: Hash },
    { key: 'notesInline', label: 'Anmerkungen im Text', icon: MessageSquareText },
    { key: 'versePerLine', label: 'Jeder Vers auf eigener Zeile', icon: AlignJustify },
];

const wakeLockSupported = isWakeLockSupported();

const menuOpen = ref(false);

watch(menuOpen, (open) => {
    if (open) emit('opened');
});

/** Reading starts where the reader is, unless that is the chapter's start. */
const readAloudLabel = computed(() =>
    props.topVerse && props.topVerse > 1 ? `Vorlesen ab Vers ${props.topVerse}` : 'Vorlesen',
);

// Each entry puts the menu away first: what it does happens on the page
// underneath, which the reader should see.
async function close() {
    menuOpen.value = false;
    await nextTick();
}

async function onBookmark() {
    await close();
    emit('bookmark');
}

async function onGoto(verse: number) {
    await close();
    emit('goto', verse);
}

async function onReadAloud() {
    await close();
    if (props.reading) emit('stopReading');
    else emit('readAloud');
}

function onScaleChange(value: number[] | undefined) {
    if (value && typeof value[0] === 'number') {
        emit('update:scale', value[0]);
    }
}
</script>
