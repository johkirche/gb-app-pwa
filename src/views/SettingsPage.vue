<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader :title="headerTitle">
            <template #leading>
                <!-- „Up to the overview", not „back a page": a link straight
                     into a section should land on the list, not leave the
                     settings altogether. -->
                <Button
                    v-if="showBack"
                    variant="ghost"
                    size="icon"
                    aria-label="Zurück zur Übersicht"
                    @click="closeSection"
                >
                    <ChevronLeft class="!size-6" aria-hidden="true" />
                </Button>
            </template>
        </AppPageHeader>

        <!-- Wide screens have room to keep every section one click away, so the
             list becomes a tab bar and the page never leaves the overview. -->
        <nav
            v-if="isDesktop"
            class="shrink-0 border-b border-border"
            aria-label="Einstellungsbereiche"
        >
            <div class="page-col -mb-px flex gap-6 overflow-x-auto scrollbar-none">
                <button
                    v-for="section in sections"
                    :key="section.key"
                    type="button"
                    class="flex shrink-0 items-center gap-2 border-b-2 pb-3 pt-2 text-[15px] transition-colors"
                    :class="
                        section.key === activeKey
                            ? 'border-primary font-medium text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    "
                    :aria-current="section.key === activeKey ? 'page' : undefined"
                    @click="selectSection(section.key)"
                >
                    <component :is="section.icon" class="size-4" aria-hidden="true" />
                    {{ section.title }}
                </button>
            </div>
        </nav>

        <main ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <!-- The panes are stacked in one grid cell, so the outgoing one
                 slides out under the incoming one instead of the page
                 collapsing to nothing between them. -->
            <div class="grid overflow-hidden">
                <Transition :name="transition">
                    <div :key="activeKey ?? 'root'" class="col-start-1 row-start-1">
                        <div
                            class="page-col space-y-10 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6"
                        >
                            <!-- Level 1 (phones only): which sections there are,
                                 and what each of them currently says. -->
                            <SettingsList v-if="activeKey === null">
                                <button
                                    v-for="section in sections"
                                    :key="section.key"
                                    type="button"
                                    class="flex w-full items-center gap-4 rounded-sm px-2 py-3.5 text-left transition-colors hover:bg-muted active:bg-muted"
                                    @click="selectSection(section.key)"
                                >
                                    <component
                                        :is="section.icon"
                                        class="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[15px]">{{ section.title }}</p>
                                        <p class="truncate text-sm text-muted-foreground">
                                            {{ section.summary }}
                                        </p>
                                    </div>
                                    <ChevronRight
                                        class="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                </button>
                            </SettingsList>

                            <!-- Level 2: one section at a time, with the whole page to itself -->
                            <AccountSettings v-else-if="activeKey === 'konto'" />
                            <AppearanceSettings v-else-if="activeKey === 'darstellung'" />
                            <PlaybackSettings v-else-if="activeKey === 'wiedergabe'" />
                            <ServiceSettings v-else-if="activeKey === 'gottesdienst'" />
                            <DataSettings
                                v-else-if="activeKey === 'daten'"
                                :files-count="filesCount"
                                :persistent-storage="persistentStorage"
                            />
                            <AboutSettings v-else />
                        </div>
                    </div>
                </Transition>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, ref, watch } from 'vue';

import {
    AudioLines,
    ChevronLeft,
    ChevronRight,
    Church,
    Contrast,
    Database,
    Info,
    User,
} from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';

import { usePreferencesStore } from '@/stores/preferences';
import { useServiceStore } from '@/stores/service';
import { useSongsStore } from '@/stores/songs';

import { useAuth } from '@/composables/useAuth';
import { useKeepAliveScroll } from '@/composables/useKeepAliveScroll';
import { useIsDesktop } from '@/composables/useMediaQuery';
import { useTheme } from '@/composables/useTheme';

import AboutSettings from '@/components/settings/AboutSettings.vue';
import AccountSettings from '@/components/settings/AccountSettings.vue';
import AppearanceSettings from '@/components/settings/AppearanceSettings.vue';
import DataSettings from '@/components/settings/DataSettings.vue';
import PlaybackSettings from '@/components/settings/PlaybackSettings.vue';
import ServiceSettings from '@/components/settings/ServiceSettings.vue';
import SettingsList from '@/components/settings/SettingsList.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import { Button } from '@/components/ui/button';

import { APP_VERSION } from '@/config/app';
import { isPersisted } from '@/services/storage';

const SECTION_KEYS = [
    'konto',
    'darstellung',
    'wiedergabe',
    'gottesdienst',
    'daten',
    'ueber',
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const THEME_LABELS = { system: 'System', light: 'Hell', dark: 'Dunkel' } as const;

const route = useRoute();
const router = useRouter();
const isDesktop = useIsDesktop();

const { user } = useAuth();
const { theme } = useTheme();
const songsStore = useSongsStore();
const preferencesStore = usePreferencesStore();
const serviceStore = useServiceStore();

// KeepAlive resets scrollTop on re-attach; save/restore it (Ionic parity)
const scrollRef = ref<HTMLElement | null>(null);
useKeepAliveScroll(scrollRef);

// Volatile enough to need refreshing on every entry — and shown twice, in the
// overview summary and inside the Daten section, so the shell owns both.
const filesCount = ref(0);
const persistentStorage = ref<boolean | null>(null);

const playbackSummary = computed(() => {
    const marks = preferencesStore.xmlSettings;
    const on = [
        // The output comes first: which instrument a hymn sounds on outranks
        // what the engraving marks while it plays.
        preferencesStore.midiOutputEnabled ? 'MIDI-Ausgabe' : null,
        marks.highlightNotes ? 'Noten hervorheben' : null,
        marks.showPlayhead ? 'Abspielbalken' : null,
    ].filter(Boolean);
    return on.length ? on.join(' · ') : 'Ohne Markierungen';
});

const serviceSummary = computed(() => {
    if (serviceStore.hasSelection) return serviceStore.selectionLabel;
    return preferencesStore.serviceTab === 'always'
        ? 'Tab immer sichtbar'
        : 'Tab nur bei vorgemerkten Liedern';
});

// The overview is a list of what each section currently says, not a bare menu:
// one line each, so a phone reader can see the state without opening anything.
const sections = computed(() => [
    {
        key: 'konto' as const,
        title: 'Konto',
        icon: User,
        summary: user.value?.email || 'Nicht angemeldet',
    },
    {
        key: 'darstellung' as const,
        title: 'Darstellung',
        icon: Contrast,
        summary: `${THEME_LABELS[theme.value]} · ${Math.round(preferencesStore.pageScale * 100)} %`,
    },
    {
        key: 'wiedergabe' as const,
        title: 'Wiedergabe',
        icon: AudioLines,
        summary: playbackSummary.value,
    },
    {
        key: 'gottesdienst' as const,
        title: 'Gottesdienst',
        icon: Church,
        summary: serviceSummary.value,
    },
    {
        key: 'daten' as const,
        title: 'Daten',
        icon: Database,
        summary: `${songsStore.songs.length} Lieder, ${filesCount.value} Dateien`,
    },
    {
        key: 'ueber' as const,
        title: 'Über die App',
        icon: Info,
        summary: `Version ${APP_VERSION}`,
    },
]);

function isSectionKey(value: unknown): value is SectionKey {
    return SECTION_KEYS.includes(value as SectionKey);
}

const routeSection = computed<SectionKey | null>(() => {
    const value = route.query.bereich;
    return isSectionKey(value) ? value : null;
});

/**
 * Which section is on show — null being the overview list, which only phones
 * ever get: on a wide screen the tabs are a view of one page, not a stack, so
 * an absent query falls back to the first tab instead of an empty page.
 */
const activeKey = computed<SectionKey | null>(
    () => routeSection.value ?? (isDesktop.value ? 'konto' : null),
);

const activeSection = computed(() => sections.value.find((s) => s.key === activeKey.value));
const showBack = computed(() => !isDesktop.value && activeKey.value !== null);
const headerTitle = computed(() =>
    showBack.value ? (activeSection.value?.title ?? 'Einstellungen') : 'Einstellungen',
);

const transition = ref<'pane-forward' | 'pane-back' | 'pane-fade'>('pane-fade');

// Pre-flush, so the name is already right when the Transition patches. Sliding
// is for the drill-down only — tabs that swapped sideways on every click would
// be a lot of motion for what is one page.
watch(activeKey, (next, previous) => {
    if (isDesktop.value) {
        transition.value = 'pane-fade';
    } else {
        transition.value = next === null && previous !== null ? 'pane-back' : 'pane-forward';
    }
    nextTick(() => {
        if (scrollRef.value) scrollRef.value.scrollTop = 0;
    });
});

function selectSection(key: SectionKey) {
    // Drilling in on a phone is a step the back gesture should undo; tabbing
    // through the sections on a wide screen is not, or six clicks would put
    // six history entries between the reader and the way out.
    const to = { query: { ...route.query, bereich: key } };
    if (isDesktop.value) {
        router.replace(to);
    } else {
        router.push(to);
    }
}

function closeSection() {
    const { bereich: _bereich, ...query } = route.query;
    router.replace({ query });
}

// As a tab child this page mounts once and stays alive across tab switches, so
// volatile values (files count after a sync, persistence state) must refresh on
// every entry — onMounted alone would show stale data until a full reload.
// (onActivated replaces Ionic's onIonViewWillEnter: the new tab shell keeps
// pages alive with <KeepAlive> instead of an ion-router-outlet.)
onActivated(async () => {
    filesCount.value = await songsStore.getStoredFilesCount();
    persistentStorage.value = await isPersisted();
});
</script>

<style scoped>
.pane-forward-enter-active,
.pane-forward-leave-active,
.pane-back-enter-active,
.pane-back-leave-active {
    transition:
        transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
        opacity 140ms ease;
}

.pane-forward-enter-from,
.pane-back-leave-to {
    opacity: 0;
    transform: translateX(100%);
}

.pane-forward-leave-to,
.pane-back-enter-from {
    opacity: 0;
    transform: translateX(-25%);
}

.pane-fade-enter-active,
.pane-fade-leave-active {
    transition: opacity 120ms ease;
}

.pane-fade-enter-from,
.pane-fade-leave-to {
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .pane-forward-enter-active,
    .pane-forward-leave-active,
    .pane-back-enter-active,
    .pane-back-leave-active {
        transition: opacity 100ms ease;
    }

    .pane-forward-enter-from,
    .pane-forward-leave-to,
    .pane-back-enter-from,
    .pane-back-leave-to {
        transform: none;
    }
}
</style>
