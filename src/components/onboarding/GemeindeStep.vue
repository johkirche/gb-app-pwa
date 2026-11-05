<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <h1 class="text-center font-display text-3xl font-semibold">
            Zu welcher Gemeinde gehören Sie?
        </h1>
        <p class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
            Damit kann die App Ihnen später die Lieder Ihrer Gottesdienste zeigen. Die Angabe ist
            freiwillig, und Sie können sie jederzeit in den Einstellungen ändern.
        </p>

        <GemeindePicker v-model="selected" class="mt-4" />

        <!-- Sticky: the list runs several screens long, and the way on should not
             be at the far end of it for someone who found their Gemeinde at the top. -->
        <div
            class="sticky bottom-0 z-10 mt-auto bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-6"
        >
            <Button
                type="button"
                size="lg"
                class="w-full"
                :disabled="saving"
                :aria-busy="saving"
                @click="next"
            >
                <Spinner v-if="saving" size="sm" class="text-primary-foreground" />
                <template v-else>
                    Weiter
                    <ArrowRight aria-hidden="true" />
                </template>
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { ArrowRight } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

import { useProfile } from '@/composables/useProfile';

import GemeindePicker from '@/components/profile/GemeindePicker.vue';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import type { GemeindeRef } from '@/utils/gemeinden';

const emit = defineEmits<{ next: [] }>();

const { gemeinde, saveProfile } = useProfile();

// Undefined until the reader chooses. A reader on a new device gets here right
// after the login, possibly before their profile has come down, and pressing on
// without touching anything must not write „none" over what the account says.
const choice = ref<GemeindeRef | null | undefined>(undefined);
const saving = ref(false);

const selected = computed({
    get: () => (choice.value === undefined ? gemeinde.value : choice.value),
    set: (value) => {
        choice.value = value;
    },
});

async function next() {
    if (saving.value) return;
    if (choice.value !== undefined) {
        saving.value = true;
        try {
            const saved = await saveProfile({ gemeinde: choice.value });
            if (!saved) {
                toast.warning(
                    'Die Gemeinde konnte nicht gespeichert werden. Sie können sie später in den Einstellungen festlegen.',
                    { duration: 5000 },
                );
            }
        } finally {
            saving.value = false;
        }
    }
    emit('next');
}
</script>
