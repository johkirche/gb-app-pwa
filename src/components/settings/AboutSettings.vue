<template>
    <SettingsList>
        <div class="flex items-center gap-4 px-2 py-3">
            <Info class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[15px]">Version</p>
                <p class="text-sm text-muted-foreground">{{ APP_VERSION }}</p>
            </div>
        </div>

        <a
            :href="`mailto:${SUPPORT_EMAIL}`"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 transition-colors hover:bg-muted active:bg-muted"
        >
            <Mail class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[15px]">Kontakt &amp; Hilfe</p>
                <p class="truncate text-sm text-muted-foreground">{{ SUPPORT_EMAIL }}</p>
            </div>
        </a>

        <button
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="router.push('/datenschutz')"
        >
            <ShieldCheck class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p class="flex-1 text-[15px]">Datenschutz</p>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>

        <button
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="router.push('/impressum')"
        >
            <FileText class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p class="flex-1 text-[15px]">Impressum</p>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
    </SettingsList>
</template>

<script setup lang="ts">
import { ChevronRight, FileText, Info, Mail, ShieldCheck } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import SettingsList from '@/components/settings/SettingsList.vue';

import { APP_VERSION } from '@/config/app';
import { SUPPORT_EMAIL } from '@/config/support';

const router = useRouter();
</script>
