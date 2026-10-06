<template>
    <Dialog :open="verse !== null" @update:open="(open) => !open && selection.closeNote()">
        <DialogContent class="max-w-md">
            <DialogHeader>
                <DialogTitle>Notiz zu {{ label }}</DialogTitle>
                <DialogDescription class="line-clamp-2">{{ verseSnippet }}</DialogDescription>
            </DialogHeader>

            <textarea
                v-model="draft"
                rows="6"
                aria-label="Notiz"
                placeholder="Ihre Gedanken zu diesem Vers"
                class="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-[0.9375rem] leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />

            <DialogFooter class="flex-row items-center justify-between sm:justify-between">
                <Button
                    v-if="existing"
                    variant="ghost"
                    class="text-destructive hover:text-destructive"
                    @click="remove"
                >
                    <Trash2 aria-hidden="true" />
                    Löschen
                </Button>
                <span v-else />
                <Button @click="save">Speichern</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

import { useNotizenStore } from '@/stores/notizen';

import { useVerseSelection } from '@/composables/useVerseSelection';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { verseRefLabel } from '@/utils/bibel';
import { snippet, verseText } from '@/utils/bibelLayout';

/**
 * The reader's note on one verse: opened from the action bar or from the
 * note icon after a verse, both through the shared selection.
 */
const selection = useVerseSelection();
const notizen = useNotizenStore();

const verse = computed(() => selection.noteVerse.value);
const here = computed(() => selection.here.value);

const existing = computed(() =>
    here.value && verse.value !== null
        ? notizen.get(here.value.slug, here.value.chapter, verse.value)
        : undefined,
);
const label = computed(() =>
    here.value && verse.value !== null ? verseRefLabel(here.value, verse.value) : '',
);
// The verse itself under the title, so the reader writes with it in view.
const verseSnippet = computed(() =>
    verse.value !== null ? snippet(verseText(selection.laid.value, verse.value), 160) : '',
);

const draft = ref('');

// A fresh draft each time the editor opens on a verse.
watch(verse, () => {
    draft.value = existing.value?.text ?? '';
});

async function save() {
    if (!here.value || verse.value === null) return;
    const { slug, chapter } = here.value;
    const deleted = !draft.value.trim() && !!existing.value;
    try {
        await notizen.save(slug, chapter, verse.value, draft.value);
        if (deleted) toast.success('Notiz gelöscht', { duration: 2000 });
        else if (draft.value.trim()) toast.success('Notiz gespeichert', { duration: 2000 });
        selection.closeNote();
    } catch (err) {
        console.error('Error saving the Notiz:', err);
        toast.error('Die Notiz konnte nicht gespeichert werden.');
    }
}

async function remove() {
    if (!existing.value) return;
    try {
        await notizen.remove(existing.value.id);
        toast.success('Notiz gelöscht', { duration: 2000 });
        selection.closeNote();
    } catch (err) {
        console.error('Error deleting the Notiz:', err);
        toast.error('Die Notiz konnte nicht gelöscht werden.');
    }
}
</script>
