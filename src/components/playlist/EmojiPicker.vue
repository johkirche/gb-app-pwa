<template>
    <Dialog :open="isOpen" @update:open="(open) => !open && emit('close')">
        <DialogContent class="max-w-sm">
            <DialogHeader>
                <DialogTitle>Emoji wählen</DialogTitle>
                <DialogDescription class="sr-only">
                    Wählen Sie ein Symbol für die Playlist.
                </DialogDescription>
            </DialogHeader>
            <div class="-mx-2 max-h-[55vh] overflow-y-auto overscroll-contain px-2">
                <div class="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2">
                    <button
                        v-for="emoji in emojis"
                        :key="emoji"
                        type="button"
                        class="flex h-12 w-12 items-center justify-center rounded-lg border text-[1.75rem] leading-none transition-colors"
                        :class="
                            emoji === selectedEmoji
                                ? 'border-primary bg-primary/10'
                                : 'border-transparent hover:bg-muted'
                        "
                        :aria-pressed="emoji === selectedEmoji"
                        @click="emit('select', emoji)"
                    >
                        {{ emoji }}
                    </button>
                </div>
            </div>
            <DialogFooter>
                <Button @click="emit('close')">Fertig</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script lang="ts">
/** The shared preset emoji list for playlist icons (also used by CreatePlaylistPage). */
export const PLAYLIST_EMOJIS = [
    '🎵',
    '🎶',
    '🎼',
    '🎹',
    '🎸',
    '🎺',
    '🎻',
    '🥁',
    '🎤',
    '🎧',
    '🎭',
    '⛪',
    '✝️',
    '🙏',
    '💒',
    '📖',
    '📿',
    '🕊️',
    '👼',
    '😇',
    '🌟',
    '⭐',
    '✨',
    '💫',
    '🌈',
    '🌸',
    '🌺',
    '🌻',
    '🌹',
    '💐',
    '❤️',
    '💙',
    '💚',
    '💛',
    '💜',
    '🤍',
    '☀️',
    '🌙',
    '🕯️',
    '🔔',
    '🎄',
    '🐣',
    '🎃',
    '🍂',
    '❄️',
    '🎉',
    '🎊',
    '👨‍👩‍👧‍👦',
    '👶',
    '👧',
    '👦',
    '🧒',
    '👴',
    '👵',
    '🤝',
    '💪',
    '🏃',
    '🧘',
    '📅',
    '📌',
    '🏠',
    '🌍',
];
</script>

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

defineProps<{
    isOpen: boolean;
    selectedEmoji?: string;
}>();

const emit = defineEmits<{
    close: [];
    select: [emoji: string];
}>();

const emojis = PLAYLIST_EMOJIS;
</script>
