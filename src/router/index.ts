import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import { useSongsStore } from '@/stores/songs';
import { useUserStore } from '@/stores/user';

import AddSongsToPlaylistPage from '../views/AddSongsToPlaylistPage.vue';
import CreatePlaylistPage from '../views/CreatePlaylistPage.vue';
import DatenschutzPage from '../views/DatenschutzPage.vue';
import DownloadPage from '../views/DownloadPage.vue';
import FavoritesPage from '../views/FavoritesPage.vue';
import ImpressumPage from '../views/ImpressumPage.vue';
import InstallPWAPage from '../views/InstallPWAPage.vue';
import LoginPage from '../views/LoginPage.vue';
import NotFoundPage from '../views/NotFoundPage.vue';
import OnboardingPage from '../views/OnboardingPage.vue';
import PasswordResetPage from '../views/PasswordResetPage.vue';
import PlaylistDetailPage from '../views/PlaylistDetailPage.vue';
import PlaylistsListPage from '../views/PlaylistsListPage.vue';
import RegisterPage from '../views/RegisterPage.vue';
import ServicePage from '../views/ServicePage.vue';
import SettingsPage from '../views/SettingsPage.vue';
import SongPage from '../views/SongPage.vue';
import SongsListPage from '../views/SongsListPage.vue';
import TabsPage from '../views/TabsPage.vue';

/**
 * What a view needs before it may be entered.
 *
 * The distinction that matters is not "logged in or not" but *what the view is
 * for*. Almost everything in this app reads a Gesangbuch that already sits in
 * IndexedDB; a Directus session had to fetch it once, but nothing about turning
 * its pages needs one afterwards. Sessions expire, phones go offline, and a
 * hymnal that locks itself in a pew is no use — so:
 *
 *  - `'public'`  – needs nothing. The way in and the pages that must stay
 *                  readable from outside the app (login, registration,
 *                  Impressum, Datenschutz).
 *  - `'library'` – needs a session *or* a downloaded Gesangbuch. The whole
 *                  reading app: songs, playlists, Gottesdienst, settings. A
 *                  reader whose session died keeps every one of these; the few
 *                  features inside them that do talk to the server say so
 *                  themselves (see `LoginRequiredNotice`) instead of the view
 *                  as a whole being taken away.
 *  - `'session'` – genuinely useless without a live account, because the view's
 *                  entire purpose is to talk to the server (the onboarding
 *                  download). These are the only views that still bounce to the
 *                  login form.
 */
export type RouteAccess = 'public' | 'library' | 'session';

declare module 'vue-router' {
    interface RouteMeta {
        /**
         * Required on every route that renders a view, so a new page cannot be
         * added without deciding what it needs. Pure redirect records may omit
         * it — vue-router resolves them before the guard runs, so their meta is
         * never read. A view that omits it anyway is treated as `'session'`: the
         * guard fails closed.
         */
        access: RouteAccess;
    }
}

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
        meta: { access: 'library' },
        children: [
            {
                path: '',
                redirect: '/tabs/lieder',
            },
            {
                path: 'lieder',
                name: 'Songs',
                component: SongsListPage,
                meta: { access: 'library' },
            },
            {
                path: 'playlisten',
                name: 'Playlists',
                component: PlaylistsListPage,
                meta: { access: 'library' },
            },
            // The Gottesdienst tab. The route exists whether or not the tab
            // is currently offered, so a link to it always resolves.
            {
                path: 'gottesdienst',
                name: 'Service',
                component: ServicePage,
                meta: { access: 'library' },
            },
            {
                path: 'einstellungen',
                name: 'Settings',
                component: SettingsPage,
                meta: { access: 'library' },
            },
        ],
    },
    {
        path: '/login',
        name: 'Login',
        component: LoginPage,
        meta: { access: 'public' },
    },
    {
        path: '/register',
        name: 'Register',
        component: RegisterPage,
        meta: { access: 'public' },
    },
    // The onboarding *is* the download, so it is one of the two views that a
    // session is genuinely required for. A reader who already has the book
    // never comes back here.
    {
        path: '/onboarding',
        name: 'Onboarding',
        component: OnboardingPage,
        meta: { access: 'session' },
    },
    {
        path: '/password-reset',
        name: 'PasswordReset',
        component: PasswordResetPage,
        meta: { access: 'public' },
    },
    // Legal pages: public so they are reachable from the login page while logged out
    {
        path: '/impressum',
        name: 'Impressum',
        component: ImpressumPage,
        meta: { access: 'public' },
    },
    {
        path: '/datenschutz',
        name: 'Datenschutz',
        component: DatenschutzPage,
        meta: { access: 'public' },
    },
    {
        path: '/songs',
        redirect: '/tabs/lieder',
    },
    {
        path: '/songs/:id',
        name: 'Song',
        component: SongPage,
        meta: { access: 'library' },
    },
    // Reachable without a session on purpose: the page reports what is stored
    // on the device and can delete it, both of which work offline. Only the
    // sync itself needs an account, and the page says so where the button is.
    {
        path: '/download',
        name: 'Download',
        component: DownloadPage,
        meta: { access: 'library' },
    },
    {
        path: '/install-pwa',
        name: 'InstallPWA',
        component: InstallPWAPage,
        meta: { access: 'library' },
    },
    {
        path: '/settings',
        redirect: '/tabs/einstellungen',
    },
    {
        path: '/favorites',
        name: 'Favorites',
        component: FavoritesPage,
        meta: { access: 'library' },
    },
    {
        path: '/playlists',
        redirect: '/tabs/playlisten',
    },
    {
        path: '/playlists/create',
        name: 'CreatePlaylist',
        component: CreatePlaylistPage,
        meta: { access: 'library' },
    },
    {
        path: '/playlists/:id',
        name: 'Playlist',
        component: PlaylistDetailPage,
        meta: { access: 'library' },
    },
    {
        path: '/playlists/:id/add-songs',
        name: 'AddSongsToPlaylist',
        component: AddSongsToPlaylistPage,
        meta: { access: 'library' },
    },
    // Dev-only design-system kitchen sink. import.meta.env.DEV is statically
    // replaced by Vite, so production builds drop the route and its chunk.
    ...(import.meta.env.DEV
        ? [
              {
                  path: '/dev/ui',
                  name: 'DevUi',
                  component: () => import('../views/DevUiPage.vue'),
                  meta: { access: 'public' },
              } satisfies RouteRecordRaw,
          ]
        : []),
    // Catch-all, last on purpose. The edge serves the SPA for every path, so an
    // unknown URL reaches the router rather than a server 404 — without this
    // record the outlet would render nothing and a standalone PWA would be
    // stranded on a blank page. Public, so it also shows while logged out
    // instead of bouncing a mistyped address to the login form.
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: NotFoundPage,
        meta: { access: 'public' },
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

    // Dev-only auth bypass. import.meta.env.DEV is statically replaced by Vite, so
    // production builds dead-code-eliminate this branch entirely; the flag itself is
    // in-memory only and never persisted.
    if (import.meta.env.DEV && userStore.devSkipAuth) {
        return true;
    }

    // An undeclared view is treated as the most restrictive kind (see RouteMeta).
    const access = to.meta.access ?? 'session';

    if (access !== 'public') {
        // A downloaded Gesangbuch is worth as much as a session to a view that
        // only reads it, so the guard has to wait for that read before it can
        // decide — mid-flight the library still looks empty.
        const songsStore = useSongsStore();
        await songsStore.initPromise;

        // `hasSongs`, not `songs.length`: the exposed `songs` is the sorted
        // computed, and re-sorting the whole book on every navigation to ask
        // whether it is empty would be a strange way to spend the frame.
        const mayEnter = userStore.isLoggedIn || (access === 'library' && songsStore.hasSongs);

        if (!mayEnter) {
            // Nothing to read and no session: the login form is the only place
            // this visit can go.
            return { name: 'Login' };
        }
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
