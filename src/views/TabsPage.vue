<template>
    <div class="flex h-full w-full flex-col bg-background lg:flex-row">
        <!-- Desktop (≥ lg): sidebar navigation -->
        <nav
            class="hidden border-r border-border bg-background lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-1 lg:px-4 lg:py-6"
            aria-label="Hauptnavigation"
        >
            <RouterLink to="/tabs/lieder" class="mb-8 flex items-center gap-3 px-2">
                <img src="/logo.svg" alt="" class="h-10 w-10" />
                <span class="font-display text-2xl font-semibold text-foreground">Gesangbuch</span>
            </RouterLink>

            <RouterLink
                v-for="tab in tabs"
                :key="tab.to"
                :to="tab.to"
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors"
                :class="
                    isActive(tab.to)
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                "
                :aria-current="isActive(tab.to) ? 'page' : undefined"
            >
                <component :is="tab.icon" class="h-5 w-5" aria-hidden="true" />
                {{ tab.label }}
            </RouterLink>
            <!-- Future tab (Gottesdienst): add an entry to `tabs` below plus a child route under /tabs/ -->
        </nav>

        <!-- Content: centered reading column on desktop, fullscreen on mobile -->
        <div class="flex min-h-0 min-w-0 flex-1 justify-center">
            <main class="relative h-full w-full max-w-3xl">
                <router-view v-slot="{ Component }">
                    <!-- KeepAlive preserves tab state (scroll position, search) the way
                         Ionic's router outlet did; pages needing refresh-on-visit use
                         onActivated. -->
                    <keep-alive>
                        <component :is="Component" />
                    </keep-alive>
                </router-view>
            </main>
        </div>

        <!-- Mobile (< lg): bottom tab bar -->
        <nav
            class="border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
            aria-label="Hauptnavigation"
        >
            <div class="flex items-stretch">
                <RouterLink
                    v-for="tab in tabs"
                    :key="tab.to"
                    :to="tab.to"
                    class="flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium transition-colors"
                    :class="isActive(tab.to) ? 'text-primary' : 'text-muted-foreground'"
                    :aria-current="isActive(tab.to) ? 'page' : undefined"
                >
                    <component :is="tab.icon" class="h-[22px] w-[22px]" aria-hidden="true" />
                    {{ tab.label }}
                </RouterLink>
                <!-- Future tab (Gottesdienst): add an entry to `tabs` plus a child route under /tabs/ -->
            </div>
        </nav>
    </div>
</template>

<script setup lang="ts">
import { ListMusic, Music, Settings } from 'lucide-vue-next';
import { useRoute } from 'vue-router';

const route = useRoute();

const tabs = [
    { to: '/tabs/lieder', label: 'Lieder', icon: Music },
    { to: '/tabs/playlisten', label: 'Playlisten', icon: ListMusic },
    // Future tab (Gottesdienst): add it here plus a child route under /tabs/
    { to: '/tabs/einstellungen', label: 'Einstellungen', icon: Settings },
];

function isActive(to: string) {
    return route.path.startsWith(to);
}
</script>
