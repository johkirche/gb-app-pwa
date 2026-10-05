# Bibelstellen from Directus

Under a song the app can show the Bible passages its text draws on — and,
where one line of the song takes a passage up, that line. Those passages are
not part of the app. They live in **one JSON file in the Directus file
library**, downloaded with the songs during the sync, behind the login.

No collection, no schema change: whether the hymnal offers Bibelstellen is
decided by whether the file is there. Delete it in the dashboard and the next
sync takes them off every device again.

## The file

- **Name:** `gesangbuch-bibelstellen.json` (`filename_download`). The app looks
  the file up by that name (`BIBELSTELLEN_FILENAME` in
  `src/services/bibelstellenSync.ts`); the newest upload wins.
- **Access:** the reading role needs **read** on `directus_files` for it, as for
  the Notenbild files. Without it the app simply shows no Bibelstellen.
- **Shape** (read and checked by `src/utils/bibelstellen.ts`):

  ```json
  {
      "version": 1,
      "generated": "2026-10-05",
      "byText": {
          "<text id>": [
              {
                  "ref": "Matthäus 21,1-11",
                  "note": "Einzug in Jerusalem und Palmenstreuen",
                  "at": ["matthaeus", 21, 1],
                  "line": { "strophe": 1, "text": "…" }
              }
          ]
      },
      "byTitle": { "<normalised title>": "<text id>" }
  }
  ```

  Keyed by the Directus `text` id; `byTitle` finds the songs stored before the
  app synced that id. `at` is the book slug of `src/assets/bibel/index.json`,
  chapter and first verse; the extent comes from `ref`. `line` is optional —
  most passages speak to the song as a whole and have none.

- **No Bible wording.** The app takes it from the Bible it carries, in the
  translation the reader chose (Menge or Luther 1912).

## Making and uploading it

In gb-scripts: `app/32-build-bibelstellen-file.py`.

1. `14-ai-extract-metadata.py` / `17-verify-bible-references.py` assign and
   check the references.
2. The review of every carried reference (keep/remove, and the song line) is
   kept in `ai_text_bible_check_verified.json` — git-ignored, as it quotes the
   songs.
3. Script 32 builds the file from both (a local copy goes to
   `ai_text_bible_check_bibelstellen.json`) and uploads it. With `DRY_RUN = True`
   (the default) it only builds and reports. When the file is already in the
   library it is replaced in place, so its id stays the same.

## In the app

- `syncAll` (`src/stores/songs.ts`) runs `syncBibelstellen()` after the files:
  it asks the library for the file, downloads it when its `modified_on` moved,
  checks the shape, and keeps it in `db.meta`. A file that is gone is removed
  from the device; a library that cannot be asked (offline, no access) leaves
  the device as it is. It can never fail the songs' sync.
- `SongBibelstellen.vue`, „Lieder zu diesem Kapitel" and the Vers der Woche
  read it through `src/utils/bibelstellen.ts`, which reloads after each sync.
- Einstellungen → Bibel says so when no file is on the device.
