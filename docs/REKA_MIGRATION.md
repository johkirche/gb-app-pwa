# Mission: Migrate the Gesangbuch PWA from Ionic to Reka UI (shadcn-vue style)

ultracode

You are migrating the UI layer of `/Users/fabraham/prog/church/gb-ionic-app-pwa` — the
offline-first PWA hymnal of the Johannische Kirche (German UI, formal „Sie") — **away from
Ionic** to a component system we own: **Reka UI primitives + shadcn-vue-style components +
Tailwind CSS**, responsive from phone to desktop. The data/offline layer is finished,
verified and MUST NOT be redesigned — this is a view-layer replacement, not a rewrite.

## Step 0 — the design reference (blocking gate)

The visual direction is this mockup of the app's first version:
https://claude.ai/design/p/733fc166-973b-47f3-bb01-d68fa1f13cda?file=index.html

Fetch and study it BEFORE writing any component. If no tool can access it (it sits behind
the claude.ai login), STOP and ask the user to paste or export its `index.html` — do not
invent a design instead. Adopt its **layout, structure, spacing, typography and component
feel** — explicitly **NOT its color scheme**. Derive a calm, hymnal-appropriate palette as
CSS variables (light + dark, class-driven `dark` on `<html>` — the app already persists
`settings.theme` = system|light|dark in localStorage), and show the user a palette
proposal for confirmation before rolling it across all views.

## What is being replaced vs. kept

REPLACED (the only Ionic surface):
- `@ionic/vue`, `@ionic/vue-router`, `ionicons` — all `Ion*` components, `alertController`,
  `toastController`, `actionSheetController`, the `mode: 'ios'` config, Ionic CSS imports
  in `src/main.ts`, `src/theme/variables.css`'s Ionic tokens.

KEPT UNTOUCHED (do not restructure; only swap UI imports where they leak in):
- Vue 3.5 + `vue-router` 5 (use it directly with `createWebHistory`; keep ALL route paths,
  names, redirects and the auth guard in `src/router/index.ts` semantically identical —
  including `/tabs/lieder|playlisten|einstellungen`, the legacy redirects, the DEV-only
  bypass and the onboarding-in-progress redirect).
- Pinia stores (`src/stores/`), Dexie `GesangbuchDB` v6 (`src/db/`), Directus SDK layer
  (`src/api/`, `src/services/directus.ts`, `errorHandler.ts`), `useAuth` + its flows
  (login, register→`/login?reason=registration_login_failed`, logout with server
  revocation, deleteAccount with extension endpoint + 403 fallback).
- vite-plugin-pwa setup (precache incl. `public/soundfonts/*`, `registerType: 'prompt'`);
  `src/composables/useAppUpdate.ts` currently uses Ionic's `toastController` — port it to
  the new toast system, keep the German copy and the update semantics exactly.
- OSMD rendering + audio (`OsmdRenderer.vue` internals, `localSoundfontPlayer.ts`,
  `SongAudioControls`): keep the engine logic, event contract
  (`rendered { lyricsRendered }` / `renderFailed` / `playStarted` / `playStopped`), lazy
  init-on-first-play with in-flight guard, and the notation state machine in
  `SongPage.vue` — restyle the chrome only.
- The 53 vitest unit tests (`useAuth.spec.ts`, `errorHandler.spec.ts`,
  `authorFormat.spec.ts`) — they are UI-free and must stay green throughout.
- All German copy, verbatim. All aria-labels/a11y affordances (icon-only buttons have
  accessible names — keep that true).
- `src/directives/longPress.ts`, `src/components/songlist/IndexScroll.vue` (custom A-Z
  strip), `DevSkipButton` dev-only async-chunk pattern (production bundles must contain
  no „Entwicklermodus" string — this is a verified security property, re-verify it).

## Target stack

- **Tailwind CSS v4** (via `@tailwindcss/vite`), tokens as CSS variables.
- **Reka UI** (`reka-ui`) primitives with **locally owned shadcn-vue-style components**
  in `src/components/ui/` (use the shadcn-vue CLI or hand-port; either way the code lives
  in-repo and is ours).
- **lucide-vue-next** for icons (replacing ionicons).
- **vue-sonner** (or the shadcn-vue Sonner port) for toasts.
- Recommended mappings: alertController → AlertDialog; action sheets → Drawer/Sheet
  (bottom on mobile); ion-select → Select (desktop) / Drawer list (mobile); ion-segment →
  Tabs or ToggleGroup; ion-toggle → Switch; ion-range → Slider; ion-checkbox → Checkbox;
  ion-reorder → a small drag solution (or defer reordering behind a follow-up issue if it
  threatens the timeline — say so explicitly); modals (EmojiPicker, PlaylistEditModal,
  PlaylistSelectModal, name editor) → Dialog/Drawer.
- Page transitions: simple `<Transition>` fades on RouterView are enough; do not try to
  recreate Ionic's stack animation.

## Responsive shell (this is the point of the migration)

One responsive app, two form factors:
- **< lg**: current mobile UX — bottom tab bar (Lieder / Playlisten / Einstellungen, with
  a marked extension point for a future Gottesdienst tab, see issue #37), fullscreen song
  view, safe-area insets (`env(safe-area-inset-*)`) for the installed PWA.
- **≥ lg (desktop variant — new)**: sidebar/rail navigation instead of the tab bar,
  content max-width, the songs list may use the extra width (e.g. two-pane: list +
  persistent song view, or a wider list — take direction from the mockup), keyboard
  support (focus states, Enter/Escape in dialogs — Reka gives most of this, keep it).

## Views to migrate (all of `src/views/` + `src/components/`)

TabsPage (→ responsive shell), SongsListPage (+ SongToolbar, SongSearchBar,
SongFilterDrawer, SongSectionHeader, IndexScroll, „Lied der Woche" card), SongPage
(+ songview components), PlaylistsListPage (pinned Favoriten row), PlaylistDetailPage,
CreatePlaylistPage, AddSongsToPlaylistPage (single-toggle checkbox rows + docked footer —
preserve the fixed semantics), FavoritesPage, SettingsPage (Konto / Darstellung segment
+ selects / Daten export-import / persistent-storage row / legal links / Konto löschen),
DownloadPage (progress, failed-files warning + retry, storage estimate), OnboardingPage
(auto-start download, escape hatch only on failure), Login/Register/PasswordReset
(password-rules checklist UI), Impressum/Datenschutz (public, offline-capable),
InstallPWAPage, HomePage does not exist anymore.

## Non-negotiable invariants (verify each at the end)

1. `vue-tsc --noEmit` 0 errors; `vitest run` all green; `pnpm build:prod` succeeds.
2. PWA: installable, works fully offline after one sync; SW update toast still appears
   („Aktualisieren / Später"); precache still contains the soundfonts; the app runs in
   the installed standalone mode without visual breakage (safe areas).
3. `dist/` contains no „Entwicklermodus", no `VITE_AUTH_TOKEN`, no dev-skip chunk.
4. Every navigation flow works: login → tabs; register → onboarding (auto-download) →
   tabs; logout → `/login`; account deletion → `/login?reason=account_deleted` with
   banner; legacy URLs (`/home`, `/songs`, `/playlists`, `/settings`) redirect; legal
   pages reachable logged-out and offline; deep link `/songs/:id` behind auth.
5. Song view: notation renders (image mode is the workhorse — only 5 songs have
   MusicXML), verse 1 never hidden, playback works offline, author/copyright footer and
   per-verse notes render.
6. German copy unchanged; formal „Sie"; no English UI strings.
7. All Ionic/`ionicons` dependencies removed from `package.json` at the end; grep proves
   no `@ionic` import remains.

## Process

Work on branch `feat/reka-ui-migration` off `main` (currently `7173797`). Use ultracode
workflows: an understand/scaffold phase (Tailwind + tokens + `src/components/ui/` kit +
responsive shell with router integrated) MUST land and be user-reviewed in the browser
(`pnpm dev`) before the view-migration waves start — get the shell and palette approved
first, then migrate view clusters in parallel waves with strict file ownership, then run
an adversarial verification pass over the invariants above (one verifier per invariant
group + a cross-cutting regression review), then fix findings. Commit in reviewable
steps on the branch; do not touch `main` or `dev`. If reordering, pull-to-refresh-like
patterns, or any Ionic behavior proves expensive to replicate, park it as a named GitHub
issue instead of silently dropping it, and say so in the final report.

Repo context worth reading first: `docs/BACKEND_SETUP.md`, issue #36 (go-live checklist),
the git log of `dev` (granular history of everything that just shipped).
