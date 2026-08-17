<template>
    <Dialog :open="isOpen" @update:open="(open) => !open && emit('close')">
        <DialogContent class="max-w-sm">
            <DialogHeader>
                <DialogTitle>Playlist bearbeiten</DialogTitle>
                <DialogDescription class="sr-only">
                    Passen Sie Name und Symbol der Playlist an.
                </DialogDescription>
            </DialogHeader>

            <!-- Emoji Picker trigger -->
            <div class="flex justify-center pt-2">
                <button
                    type="button"
                    class="flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-muted text-6xl leading-none transition-transform hover:scale-105 active:scale-95"
                    @click="showEmojiPicker = true"
                >
                    {{ localEmoji }}
                </button>
            </div>

            <!-- Name Input -->
            <div class="space-y-2">
                <Label for="edit-playlist-name">Name der Playlist</Label>
                <div class="relative">
                    <Input id="edit-playlist-name" v-model="localName" class="pr-10" />
                    <button
                        v-if="localName"
                        type="button"
                        class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Eingabe löschen"
                        @click="localName = ''"
                    >
                        <X class="size-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <DialogFooter class="items-end">
                <Button
                    size="icon"
                    :disabled="!localName.trim()"
                    aria-label="Speichern"
                    @click="handleSave"
                >
                    <Check aria-hidden="true" />
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- Emoji Picker Modal (nested dialog) -->
    <EmojiPicker
        :is-open="showEmojiPicker"
        :selected-emoji="localEmoji"
        @close="showEmojiPicker = false"
        @select="handleEmojiSelect"
    />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import { Check, X } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import EmojiPicker from './EmojiPicker.vue';

const props = defineProps<{
    isOpen: boolean;
    name: string;
    emoji: string;
}>();

const emit = defineEmits<{
    close: [];
    save: [data: { name: string; emoji: string }];
}>();

const localName = ref(props.name);
const localEmoji = ref(props.emoji);
const showEmojiPicker = ref(false);

// Sync local state when props change
watch(
    () => props.isOpen,
    (isOpen) => {
        if (isOpen) {
            localName.value = props.name;
            localEmoji.value = props.emoji;
        }
    },
);

function handleEmojiSelect(emoji: string) {
    localEmoji.value = emoji;
    showEmojiPicker.value = false;
}

function handleSave() {
    if (!localName.value.trim()) return;
    emit('save', {
        name: localName.value.trim(),
        emoji: localEmoji.value,
    });
}
</script>
