<template>
    <!-- The download carries on behind the steps after it; what it is doing
         stays in sight on each of them, worded as the download step words
         it. -->
    <div class="rounded-lg bg-muted p-4">
        <template v-if="isSyncing">
            <p class="text-sm text-muted-foreground">
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
                class="mt-3"
            />
        </template>
        <p v-else-if="downloadComplete" class="flex items-center gap-3 text-sm">
            <CircleCheck class="size-5 shrink-0 text-primary" aria-hidden="true" />
            Das Gesangbuch ist geladen.
        </p>
        <div v-else-if="failed" class="flex flex-col items-start gap-2">
            <p class="text-sm leading-relaxed text-destructive">
                <template v-if="failedCount > 0">
                    {{ failedCount }} Dateien konnten nicht heruntergeladen werden.
                </template>
                <template v-else>{{ syncError }}</template>
            </p>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                @click="failedCount > 0 ? $emit('retry') : $emit('download')"
            >
                Erneut versuchen
            </Button>
        </div>
        <div v-else class="flex flex-col items-start gap-2">
            <p class="text-sm leading-relaxed text-muted-foreground">
                Das Gesangbuch ist noch nicht heruntergeladen. Das geht jetzt oder später über die
                Liederliste.
            </p>
            <Button type="button" variant="ghost" size="sm" @click="$emit('download')">
                <Download aria-hidden="true" />
                Jetzt laden
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { CircleCheck, Download } from 'lucide-vue-next';

import type { DownloadState } from '@/components/onboarding/downloadState';
import { Button } from '@/components/ui/button';
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
