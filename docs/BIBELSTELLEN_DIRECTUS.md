# Bibelstellen in Directus

The Bible passages a song text draws on — and, where the song takes one up in a
particular line, that line — belong with the songs: behind the login, editable
in the dashboard, synced like everything else. This describes the collection,
how it gets filled, and what the app changes once it exists.

Until then the app ships `src/assets/bibelstellen.json`: references, notes and
Bible wording only, **no words of the songs** — this repository is public and
many song texts are under copyright.

## Collection `bibelstelle`

One row per passage cited by one song text.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer, auto | |
| `text` | M2O → `text` | the song text; on delete of the text: cascade |
| `referenz` | string, required | as read, e.g. `Matthäus 21,1-11` |
| `buch` | string, required | the app's book slug, e.g. `matthaeus` (see `src/assets/bibel/index.json`) |
| `kapitel` | integer, required | first chapter |
| `vers` | integer, nullable | first verse; null = whole chapter |
| `bis_kapitel` | integer, nullable | last chapter of a range across chapters |
| `bis_vers` | integer, nullable | last verse of a range |
| `anmerkung` | text, nullable | what the song takes from the passage, one phrase |
| `strophe` | integer, nullable | 1-based; set only together with `zeile` |
| `zeile` | text, nullable | the words of the song that take the passage up, verbatim |
| `status` | string, dropdown | `ki` (machine-assigned, unreviewed) · `geprueft` (checked) · `verworfen` (rejected, kept so it is not re-imported) |
| `quelle` | string, nullable | e.g. `ki-qwen-2026-05 / claude-check-2026-10` |
| `sort` | integer, nullable | order within the text |
| `date_updated` | timestamp, system | so the app's delta sync sees edits (below) |

On `text`, add the O2M alias field `bibelstellen` (→ `bibelstelle.text`).

### Permissions

The same as `text` for the reading role ("activated", see BACKEND_SETUP.md):
**read**, filtered to `status` ≠ `verworfen`. No create/update/delete. Editors
get full access in the dashboard. The public role gets nothing.

## Filling it

gb-scripts owns the pipeline, as it does for the text reviews
(`16-push-reviews-to-directus.py`):

1. `14-ai-extract-metadata.py` and `17-verify-bible-references.py` — the
   machine-assigned references and their automatic checks.
2. A review pass over every reference: keep or reject, and the song line where
   one specific line takes the passage up. Kept locally as
   `ai_text_bible_check_verified.json` (git-ignored: it quotes the songs).
3. A push script writes the rows with `status = ki`, skipping texts that
   already have rows, so edits made in the dashboard are never overwritten.
   Dry run by default.

## In the app, once the collection exists

- `SONGS_QUERY` (`src/api/songs.api.ts`) selects
  `textId { bibelstellen { referenz buch kapitel vers bis_vers anmerkung strophe zeile } }`
  — **only after the field exists**: an unknown field fails the whole query,
  and with it the sync.
- `Song` gains `bibelstellen?: …` (optional, so stored songs stay valid).
- The delta sync must learn of them: a row added or edited in `bibelstelle`
  does **not** move the text's `date_updated`, so the manifest query
  (`MANIFEST_QUERY`) also selects `textId { bibelstellen { date_updated } }`
  and `src/utils/syncDiff.ts` compares the newest of those. (Enable
  `date_updated` on the collection for that.) Songs stored before carry no
  such stamp and are refetched once.
- `SongBibelstellen.vue` reads the song's own rows; the passage wording comes
  from the Bible files the app already has (`loadBook`), not from Directus.
  The `line` support is already in place (`Strophe 1: „…"`, grouped under
  „Zum ganzen Lied" for the rest).
- `src/assets/bibelstellen.json` and its build step in `scripts/build-bibel.py`
  go; "Lieder zu diesem Kapitel" and the Vers der Woche build their reverse
  index from the synced songs instead.
