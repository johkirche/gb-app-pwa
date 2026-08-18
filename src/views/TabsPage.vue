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

            <!-- Quick access (desktop only; on mobile these live inside the tabs) -->
            <p class="label-micro mt-8 px-3 pb-1 text-muted-foreground">Schnellzugriff</p>
            <RouterLink
                v-for="link in quickLinks"
                :key="link.to"
                :to="link.to"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <component :is="link.icon" class="h-[18px] w-[18px]" aria-hidden="true" />
                {{ link.label }}
            </RouterLink>

            <!-- Profile (bottom) -->
            <div class="mt-auto border-t border-border pt-3">
                <DropdownMenu>
                    <DropdownMenuTrigger
                        class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                        aria-label="Kontomenü"
                    >
                        <span
                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[15px] font-semibold text-accent-foreground"
                            aria-hidden="true"
                        >
                            <template v-if="initials">{{ initials }}</template>
                            <User v-else class="h-4 w-4" />
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block truncate text-sm font-medium text-foreground">
                                {{ profileName }}
                            </span>
                            <span
                                v-if="user?.email"
                                class="block truncate text-xs text-muted-foreground"
                            >
                                {{ user.email }}
                            </span>
                        </span>
                        <ChevronsUpDown
                            class="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" class="w-56">
                        <DropdownMenuItem @select="router.push('/tabs/einstellungen')">
                            <Settings class="h-4 w-4" aria-hidden="true" />
                            Einstellungen
                        </DropdownMenuItem>
                        <template v-if="isLoggedIn">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" @select="handleLogout">
                                <LogOut class="h-4 w-4" aria-hidden="true" />
                                Abmelden
                            </DropdownMenuItem>
                        </template>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>

        <!-- Content: centered reading column on desktop, fullscreen on mobile -->
        <div class="flex min-h-0 min-w-0 flex-1 justify-center">
            <main class="relative h-full w-full">
                <router-view v-slot="{ Component }">
                    <!-- KeepAlive preserves tab state the way Ionic's router outlet
                         did (scroll positions via useKeepAliveScroll); pages needing
                         refresh-on-visit use onActivated. -->
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
import { computed } from 'vue';

import {
    ChevronsUpDown,
    CloudDownload,
    Heart,
    ListMusic,
    LogOut,
    Music,
    Settings,
    User,
} from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const route = useRoute();
const router = useRouter();
const { user, isLoggedIn, logout } = useAuth();
const { confirm } = useConfirm();

const tabs = [
    { to: '/tabs/lieder', label: 'Lieder', icon: Music },
    { to: '/tabs/playlisten', label: 'Playlisten', icon: ListMusic },
    // Future tab (Gottesdienst): add it here plus a child route under /tabs/
    { to: '/tabs/einstellungen', label: 'Einstellungen', icon: Settings },
];

const quickLinks = [
    { to: '/favorites', label: 'Favoriten', icon: Heart },
    { to: '/download', label: 'Synchronisieren', icon: CloudDownload },
];

function isActive(to: string) {
    return route.path.startsWith(to);
}

const profileName = computed(() => {
    if (user.value?.firstName || user.value?.lastName) {
        return [user.value.firstName, user.value.lastName].filter(Boolean).join(' ');
    }
    return user.value?.email ?? 'Nicht angemeldet';
});

const initials = computed(() => {
    const first = user.value?.firstName?.trim()?.[0] ?? '';
    const last = user.value?.lastName?.trim()?.[0] ?? '';
    if (first || last) return (first + last).toUpperCase();
    return user.value?.email?.[0]?.toUpperCase() ?? '';
});

// Same flow and copy as SettingsPage's Abmelden row
async function handleLogout() {
    const proceed = await confirm({
        title: 'Abmelden',
        message:
            'Möchten Sie sich wirklich abmelden? Ihre Playlists, Favoriten und Einstellungen werden dabei von diesem Gerät gelöscht.',
        confirmText: 'Abmelden',
    });
    if (!proceed) return;

    await logout();
    router.push('/login');
}
</script>
