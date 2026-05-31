<template>
    <ion-page>
        <ion-content :fullscreen="true">
            <!-- Top icons: profile (left) and settings (right) -->
            <ion-button
                fill="clear"
                class="floating-button floating-button--top-left"
                style="--color: var(--ion-color-medium)"
                @click="navigateToSettings"
            >
                <ion-icon slot="icon-only" :icon="personOutline"></ion-icon>
            </ion-button>
            <ion-button
                fill="clear"
                class="floating-button floating-button--top-right"
                style="--color: var(--ion-color-medium)"
                @click="navigateToSettings"
            >
                <ion-icon slot="icon-only" :icon="settingsOutline"></ion-icon>
            </ion-button>

            <div class="home-container">
                <!-- Header: logo + date + greeting -->
                <header class="home-header">
                    <img src="/logo.svg" alt="Johannische Kirche" class="home-logo" />
                    <p class="home-header__date">{{ formattedDate }}</p>
                    <h1 class="home-header__greeting">
                        {{ greeting }}
                        <template v-if="displayName">,</template>
                        <template v-if="displayName">
                            <br />
                            <span class="home-header__name">{{ displayName }}</span>
                        </template>
                    </h1>
                    <div class="home-divider" aria-hidden="true">
                        <span class="home-divider__dot"></span>
                    </div>
                </header>

                <div v-if="isLoading" class="state-container--inline">
                    <ion-spinner name="crescent"></ion-spinner>
                </div>

                <template v-else>
                    <!-- Featured: Lied der Woche -->
                    <button
                        v-if="songOfTheWeek"
                        class="featured-card"
                        type="button"
                        @click="openSongOfTheWeek"
                    >
                        <p class="featured-card__label">Lied der Woche</p>
                        <div class="featured-card__body">
                            <span class="featured-card__number">{{ songOfTheWeek.index }}</span>
                            <span class="featured-card__title">{{ songOfTheWeek.titel }}</span>
                        </div>
                        <p class="featured-card__meta">{{ songOfTheWeekMeta }}</p>
                    </button>

                    <!-- Navigation list -->
                    <nav class="home-nav">
                        <button class="home-nav__item" type="button" @click="navigateToSongs">
                            <span class="home-nav__icon">
                                <ion-icon :icon="listOutline"></ion-icon>
                            </span>
                            <span class="home-nav__text">
                                <span class="home-nav__title">Lieder</span>
                                <span class="home-nav__subtitle">{{ songCountLabel }}</span>
                            </span>
                            <ion-icon
                                class="home-nav__chevron"
                                :icon="chevronForwardOutline"
                            ></ion-icon>
                        </button>

                        <button class="home-nav__item" type="button" @click="navigateToPlaylists">
                            <span class="home-nav__icon">
                                <ion-icon :icon="discOutline"></ion-icon>
                            </span>
                            <span class="home-nav__text">
                                <span class="home-nav__title">Playlisten</span>
                                <span class="home-nav__subtitle">{{ playlistCountLabel }}</span>
                            </span>
                            <ion-icon
                                class="home-nav__chevron"
                                :icon="chevronForwardOutline"
                            ></ion-icon>
                        </button>

                        <button class="home-nav__item" type="button" @click="navigateToFavorites">
                            <span class="home-nav__icon">
                                <ion-icon :icon="heartOutline"></ion-icon>
                            </span>
                            <span class="home-nav__text">
                                <span class="home-nav__title">Favoriten</span>
                                <span class="home-nav__subtitle">{{ favoriteCountLabel }}</span>
                            </span>
                            <ion-icon
                                class="home-nav__chevron"
                                :icon="chevronForwardOutline"
                            ></ion-icon>
                        </button>
                    </nav>
                </template>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { IonButton, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/vue';
import {
    chevronForwardOutline,
    discOutline,
    heartOutline,
    listOutline,
    personOutline,
    settingsOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';

import { useFavoritesStore } from '@/stores/favorites';
import { usePlaylistsStore } from '@/stores/playlists';
import { useSongsStore } from '@/stores/songs';

import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { user, isLoading } = useAuth();
const songsStore = useSongsStore();
const playlistsStore = usePlaylistsStore();
const favoritesStore = useFavoritesStore();

const displayName = computed(() => user.value?.firstName?.trim() || '');

const now = new Date();

const formattedDate = computed(() => {
    const formatter = new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    return `${weekday} · ${day}. ${month}`.toUpperCase();
});

const greeting = computed(() => {
    const hour = now.getHours();
    if (hour < 5) return 'Gute Nacht';
    if (hour < 11) return 'Guten Morgen';
    if (hour < 17) return 'Guten Tag';
    if (hour < 22) return 'Guten Abend';
    return 'Gute Nacht';
});

// ISO week number — used to pick a stable "song of the week"
function getIsoWeek(date: Date): number {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const diff = target.getTime() - firstThursday.getTime();
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

const songOfTheWeek = computed(() => {
    const songs = songsStore.songs.filter((s) => s.index);
    if (!songs.length) return null;
    const week = getIsoWeek(now);
    return songs[week % songs.length] ?? null;
});

const songOfTheWeekMeta = computed(() => {
    const song = songOfTheWeek.value;
    if (!song) return '';
    const category = song.kategorien?.[0]?.name ?? '';
    const verseCount = song.strophen?.length ?? 0;
    const verseLabel = verseCount === 1 ? '1 Strophe' : `${verseCount} Strophen`;
    return [category, verseLabel].filter(Boolean).join(' · ').toUpperCase();
});

const songCountLabel = computed(() => {
    const count = songsStore.songs.length;
    return count === 1 ? '1 Gesang' : `${count} Gesänge`;
});

const playlistCountLabel = computed(() => {
    const count = playlistsStore.playlists.length;
    return count === 1 ? '1 Liste' : `${count} Listen`;
});

const favoriteCountLabel = computed(() => {
    const count = favoritesStore.favorites.length;
    return count === 1 ? '1 gespeichert' : `${count} gespeichert`;
});

function navigateToSongs() {
    if (songsStore.songs.length === 0) {
        router.push('/download');
    } else {
        router.push('/songs');
    }
}

function navigateToPlaylists() {
    router.push('/playlists');
}

function navigateToFavorites() {
    router.push('/favorites');
}

function navigateToSettings() {
    router.push('/settings');
}

function openSongOfTheWeek() {
    if (!songOfTheWeek.value) return;
    router.push(`/songs/${songOfTheWeek.value.id}`);
}
</script>

<style scoped>
.home-container {
    max-width: var(--container-sm);
    margin: 0 auto;
    padding: calc(var(--spacing-2xl) + var(--spacing-md)) var(--spacing-lg) var(--spacing-xl);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--spacing-lg);
    /* Fill the viewport and center the sparse content so it isn't stranded
       at the top with a large empty gap below. min-height (not height) lets
       the container grow and scroll if content ever exceeds the screen. */
    min-height: 100%;
}

/* Header */
.home-header {
    text-align: center;
}

.home-logo {
    display: block;
    width: 4.5rem;
    height: auto;
    margin: 0 auto var(--spacing-lg);
}

.home-header__date {
    margin: 0 0 var(--spacing-md);
    font-size: var(--font-size-xs);
    letter-spacing: 0.18em;
    color: var(--ion-color-medium);
}

.home-header__greeting {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 600;
    line-height: 1.2;
}

.home-header__name {
    font-style: italic;
    font-weight: 500;
}

.home-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-lg);
}

.home-divider::before,
.home-divider::after {
    content: '';
    flex: 1;
    max-width: 5rem;
    height: 1px;
    background: var(--ion-color-light-shade);
}

.home-divider__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ion-color-medium);
    transform: rotate(45deg);
}

/* Featured card */
.featured-card {
    text-align: left;
    background: var(--ion-color-light);
    border: 1px solid var(--ion-color-light-shade);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    cursor: pointer;
    transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
}

.featured-card:active {
    transform: scale(0.99);
}

.featured-card__label {
    margin: 0;
    font-size: var(--font-size-xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ion-color-medium);
}

.featured-card__body {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--ion-color-light-shade);
}

.featured-card__number {
    font-size: var(--font-size-3xl);
    font-weight: 600;
    line-height: 1;
}

.featured-card__title {
    font-size: var(--font-size-lg);
    font-weight: 500;
    line-height: 1.3;
}

.featured-card__meta {
    margin: 0;
    font-size: var(--font-size-xs);
    letter-spacing: 0.14em;
    color: var(--ion-color-medium);
}

/* Nav list */
.home-nav {
    display: flex;
    flex-direction: column;
}

.home-nav__item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ion-color-light-shade);
    padding: var(--spacing-md) var(--spacing-xs);
    cursor: pointer;
    text-align: left;
    color: inherit;
}

.home-nav__item:last-child {
    border-bottom: none;
}

.home-nav__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--ion-color-light-shade);
    border-radius: var(--radius-md);
    font-size: var(--font-size-lg);
    color: var(--ion-color-medium-shade);
}

.home-nav__text {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.home-nav__title {
    font-size: var(--font-size-base);
    font-weight: 500;
}

.home-nav__subtitle {
    font-size: var(--font-size-sm);
    color: var(--ion-color-medium);
}

.home-nav__chevron {
    color: var(--ion-color-medium);
    font-size: var(--font-size-base);
}
</style>
