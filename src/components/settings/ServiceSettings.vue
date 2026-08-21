<template>
    <SettingsList>
        <div class="flex items-center justify-between gap-4 px-2 py-3">
            <div class="flex min-w-0 items-center gap-4">
                <Church class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0">
                    <Label for="settings-service-tab" class="text-[15px] font-normal">
                        Tab immer anzeigen
                    </Label>
                    <p class="text-sm text-muted-foreground">
                        Sonst erscheint er nur, solange Lieder vorgemerkt sind
                    </p>
                </div>
            </div>
            <Switch
                id="settings-service-tab"
                :model-value="serviceTabPinned"
                @update:model-value="setServiceTabPinned"
            />
        </div>

        <button
            v-if="hasServiceSelection"
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="router.push('/tabs/gottesdienst')"
        >
            <CalendarDays class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0 flex-1">
                <p class="text-[15px]">Vorgemerkte Lieder</p>
                <p class="truncate text-sm text-muted-foreground">
                    {{ serviceSelectionLabel }}
                </p>
            </div>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
    </SettingsList>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { CalendarDays, ChevronRight, Church } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { usePreferencesStore } from '@/stores/preferences';
import { useServiceStore } from '@/stores/service';

import SettingsList from '@/components/settings/SettingsList.vue';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const router = useRouter();
const preferencesStore = usePreferencesStore();
const serviceStore = useServiceStore();

// Whether the tab is pinned, and what is currently marked for a service
const serviceTabPinned = computed(() => preferencesStore.serviceTab === 'always');
const hasServiceSelection = computed(() => serviceStore.hasSelection);
const serviceSelectionLabel = computed(() => serviceStore.selectionLabel);

function setServiceTabPinned(pinned: boolean) {
    preferencesStore.setServiceTab(pinned ? 'always' : 'auto');
}
</script>
