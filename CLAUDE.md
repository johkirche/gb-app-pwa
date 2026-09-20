# Repo conventions

## Git

**Never squash commits.** Not when merging a branch, not when landing work on `dev` or
`main`, not to "tidy up" a series. Every commit that was written stays its own commit.

Squashing has already cost this repo real pain: `main` carries two squashed commits
(`4f2269f`, `7173797`) that reproduce eleven commits still living on `dev`. The trees are
byte-identical, but git no longer knows that — so any branch cut from `main` collides with
`dev` across the whole view layer in conflicts that are pure history artefacts, with the
"correct" resolution already sitting in both sides.

Merge or rebase, keep the individual commits, and let the history stay honest about what
happened.

## Readability

The app is read in a pew, at arm's length, often by someone who needs the page
larger than the person who wrote it does. Four rules follow from that.
`src/theme/readability.spec.ts` (runs with `pnpm test:unit`) fails if any of
them is broken in the source.

**Never lock the viewport.** No `user-scalable=no`, no `maximum-scale`. Pinch is
the floor under everything else; the app's own Größe is the comfortable path,
not a replacement.

**Never lock the orientation.** The manifest (`src/config/pwaManifest.ts`) sets
no `orientation`. Sideways is how a narrow screen gets long verse lines, and
every page already lays out at any width.

**Set type in rem, never px.** One control — Größe, in Einstellungen and in the
song menu — is the whole app's size. It reaches the type through
`--page-scale` → `--app-scale` → the root `font-size` in `src/theme/main.css`,
so every rem in the codebase moves with it and every px ignores it. The same
goes for icons and badges that sit with type: size them in rem, or they stay
put while their label grows.

There are three deliberate exceptions, each commented where it stands: two SVG
previews, where px is a user unit inside the viewBox, and the A–Z index rail,
which is aimed at rather than read and must fit the viewport's height.

**A new page scales, or it isn't finished.** Anything measured in px stays
where it is, which is right for device geometry (`--page-col-max`,
`--notation-max`, the phone frame in the dev preview) and wrong for anything
the reader reads.

Stating the type in rem is only half of it: the layout then has to survive the
type getting bigger. `tests/e2e/readability-scale.spec.ts` walks the shell at
50%, 100% and 200% and fails on anything that leaves the side of a 390px phone
— which is how the Einstellungen overview was caught truncating its summaries
into the void. It walks it three times over — Chromium, Firefox and WebKit —
because a rem is only as good as the engine laying it out, and WebKit is not
Safari's alone: every browser on iOS is WebKit underneath, Chrome included.
Playwright starts the dev server itself (port 8100, reusing one that is
already up), so the run is one command:

```sh
pnpm exec playwright install   # once per clone: the three engines
pnpm test:e2e                  # --ui to step through it
pnpm test:e2e --project=webkit # or narrow it to the engine that failed
```

Add a new page to that spec. The usual cause of a failure is a flex or grid
item without `min-w-0`: neither will shrink below its content's min-content
width, and a `truncate`d line's min-content is the whole unbroken string.

## End-to-end tests

The suite runs on Playwright, on all three engines, against a dev server it
starts itself:

```sh
pnpm test:e2e                  # --ui to step through, --project=webkit to narrow
```

**The backend is recorded, not faked.** The app talks to exactly three things —
a GraphQL endpoint, Directus' auth routes, and `/assets/<id>` for the two
notation files a song carries. A hand-built fake of that would drift from the
real schema the moment someone adds a field and would go on passing while it
did. So the suite records the real traffic into a HAR and replays it: what the
tests run against is not an imitation of the backend but a photograph of it.

```sh
pnpm test:e2e:record           # once, and again whenever the schema moves
```

Recording needs a real Directus account in `.env` — `E2E_DIRECTUS_EMAIL` and
`E2E_DIRECTUS_PASSWORD`, **without** a `VITE_` prefix, because anything carrying
that prefix is inlined verbatim into the built JS and shipped to every visitor.
They are read by `playwright.config.ts` in Node and never reach the bundle.
Only the recording uses them; a replay stubs the login, so no password and no
real token is ever written into a fixture.

Onboarding is a two-step wizard, so the recording walks it: „Weiter" past the
install prompt, then the download starts on its own and the run sits out the
whole book, printing each phase as it goes. The fixture is a `.zip`, not a bare
`.har` — Playwright then stores each response as its own entry instead of
base64'ing every engraving into one JSON document and parsing it whole per
context.

**The recording never gets committed.** It holds real hymn texts and engravings,
which are not ours to redistribute, so `tests/e2e/fixtures/` is git-ignored. A
clone without one reports the backend specs as skipped and says what to run —
it does not quietly pass having tested nothing.

On a replay, anything the recording cannot answer is aborted rather than let
through, so a request that would have reached the real backend fails the test
instead of turning the suite into a live integration run by accident. When
replay starts failing on requests that used to match, the schema has moved:
re-record.
