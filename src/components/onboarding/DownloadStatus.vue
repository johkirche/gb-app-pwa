<template>
    <!-- The download carries on behind the steps after it, so what it is doing
         stays in sight on each of them: one small line above the button, not a
         second thing to read beside what the step is about. -->
    <div class="text-[0.8125rem] leading-relaxed text-muted-foreground">
        <template v-if="isSyncing">
            <p class="text-center">
                <template v-if="filesKnown">
                    Das Gesangbuch wird geladen ·
                    <span class="tabular-nums">
                        {{ syncProgress.current }} von {{ syncProgress.total }} Dateien
                    </span>
                </template>
                <template v-else>Das Gesangbuch wird geladen...</template>
            </p>
            <Progress
                v-if="filesKnown"
                :model-value="syncProgress.current / syncProgress.total"
                class="mt-1.5 h-1"
            />
        </template>
        <p v-else-if="downloadComplete" class="flex items-center justify-center gap-1.5">
            <CircleCheck class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            Das Gesangbuch ist geladen.
        </p>
        <p v-else-if="failed" class="text-center text-destructive">
            <template v-if="failedCount > 0">
                {{ failedCount }} Dateien konnten nicht heruntergeladen werden.
            </template>
            <template v-else>{{ syncError }}</template>
            <button
                type="button"
                class="ml-1 font-medium underline underline-offset-2"
                @click="failedCount > 0 ? $emit('retry') : $emit('download')"
            >
                Erneut versuchen
            </button>
        </p>
        <p v-else class="text-center">
            Das Gesangbuch ist noch nicht heruntergeladen.
            <button
                type="button"
                class="ml-1 font-medium text-primary underline underline-offset-2"
                @click="$emit('download')"
            >
                Jetzt laden
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { CircleCheck } from 'lucide-vue-next';

import type { DownloadState } from '@/components/onboarding/downloadState';
import { Progress } from '@/components/ui/progress';

const props = defineProps<DownloadState>();

defineEmits<{
    download: [];
    retry: [];
}>();

const filesKnown = computed(
    () => props.syncProgress.phase === 'files' && props.syncProgress.total > 0,
);

const failed = computed(
    () =>
        props.downloadStarted &&
        !props.isSyncing &&
        !props.downloadComplete &&
        (!!props.syncError || props.failedCount > 0),
);
</script>
