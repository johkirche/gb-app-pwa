import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';

import { useUserStore } from '@/stores/user';

import AddSongsToPlaylistPage from '../views/AddSongsToPlaylistPage.vue';
import CreatePlaylistPage from '../views/CreatePlaylistPage.vue';
import DatenschutzPage from '../views/DatenschutzPage.vue';
import DownloadPage from '../views/DownloadPage.vue';
import FavoritesPage from '../views/FavoritesPage.vue';
import ImpressumPage from '../views/ImpressumPage.vue';
import InstallPWAPage from '../views/InstallPWAPage.vue';
import LoginPage from '../views/LoginPage.vue';
import OnboardingPage from '../views/OnboardingPage.vue';
import PasswordResetPage from '../views/PasswordResetPage.vue';
import PlaylistDetailPage from '../views/PlaylistDetailPage.vue';
import PlaylistsListPage from '../views/PlaylistsListPage.vue';
import RegisterPage from '../views/RegisterPage.vue';
import SettingsPage from '../views/SettingsPage.vue';
import SongPage from '../views/SongPage.vue';
import SongsListPage from '../views/SongsListPage.vue';
import TabsPage from '../views/TabsPage.vue';

const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        redirect: '/tabs/lieder',
    },
    // Legacy bookmark redirects (pre-tab-bar URLs)
    {
        path: '/home',
        redirect: '/tabs/lieder',
    },
    {
        path: '/tabs/',
        component: TabsPage,
        meta: { requiresAuth: true },
        children: [
            {
                path: '',
                redirect: '/tabs/lieder',
            },
            {
                path: 'lieder',
                name: 'Songs',
                component: SongsListPage,
                meta: { requiresAuth: true },
            },
            {
                path: 'playlisten',
                name: 'Playlists',
                component: PlaylistsListPage,
                meta: { requiresAuth: true },
            },
            // Future tab (Gottesdienst): add its child route here
            {
                path: 'einstellungen',
                name: 'Settings',
                component: SettingsPage,
                meta: { requiresAuth: true },
            },
        ],
    },
    {
        path: '/login',
        name: 'Login',
        component: LoginPage,
        meta: { requiresAuth: false },
    },
    {
        path: '/register',
        name: 'Register',
        component: RegisterPage,
        meta: { requiresAuth: false },
    },
    {
        path: '/onboarding',
        name: 'Onboarding',
        component: OnboardingPage,
        meta: { requiresAuth: true },
    },
    {
        path: '/password-reset',
        name: 'PasswordReset',
        component: PasswordResetPage,
        meta: { requiresAuth: false },
    },
    // Legal pages: public so they are reachable from the login page while logged out
    {
        path: '/impressum',
        name: 'Impressum',
        component: ImpressumPage,
        meta: { requiresAuth: false },
    },
    {
        path: '/datenschutz',
        name: 'Datenschutz',
        component: DatenschutzPage,
        meta: { requiresAuth: false },
    },
    {
        path: '/songs',
        redirect: '/tabs/lieder',
    },
    {
        path: '/songs/:id',
        name: 'Song',
        component: SongPage,
        meta: { requiresAuth: true },
    },
    {
        path: '/download',
        name: 'Download',
        component: DownloadPage,
        meta: { requiresAuth: true },
    },
    {
        path: '/install-pwa',
        name: 'InstallPWA',
        component: InstallPWAPage,
        meta: { requiresAuth: true },
    },
    {
        path: '/settings',
        redirect: '/tabs/einstellungen',
    },
    {
        path: '/favorites',
        name: 'Favorites',
        component: FavoritesPage,
        meta: { requiresAuth: true },
    },
    {
        path: '/playlists',
        redirect: '/tabs/playlisten',
    },
    {
        path: '/playlists/create',
        name: 'CreatePlaylist',
        component: CreatePlaylistPage,
        meta: { requiresAuth: true },
    },
    {
        path: '/playlists/:id',
        name: 'Playlist',
        component: PlaylistDetailPage,
        meta: { requiresAuth: true },
    },
    {
        path: '/playlists/:id/add-songs',
        name: 'AddSongsToPlaylist',
        component: AddSongsToPlaylistPage,
        meta: { requiresAuth: true },
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

// Navigation guard for authentication
router.beforeEach(async (to) => {
    const userStore = useUserStore();

    // Wait for user data to be loaded from IndexedDB
    await userStore.initPromise;

    const requiresAuth = to.meta.requiresAuth;

    // Dev-only auth bypass. import.meta.env.DEV is statically replaced by Vite, so
    // production builds dead-code-eliminate this branch entirely; the flag itself is
    // in-memory only and never persisted.
    if (import.meta.env.DEV && userStore.devSkipAuth) {
        return true;
    }

    // If route requires authentication and user is not logged in
    if (requiresAuth && !userStore.isLoggedIn) {
        // Redirect to login page
        return { name: 'Login' };
    }

    // If user is logged in and trying to access login/register, redirect into the app
    if (userStore.isLoggedIn && (to.name === 'Login' || to.name === 'Register')) {
        return { path: '/tabs/lieder' };
    }

    // If onboarding is in progress, keep the user on onboarding instead of landing on the tabs
    // (e.g. when the PWA is installed and launched fresh)
    try {
        const onboardingInProgress = localStorage.getItem('onboarding.inProgress') === '1';
        if (onboardingInProgress && userStore.isLoggedIn && to.path.startsWith('/tabs')) {
            return { name: 'Onboarding' };
        }
    } catch {
        // ignore storage errors
    }

    // Allow navigation
    return true;
});

export default router;
