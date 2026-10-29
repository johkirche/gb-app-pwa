// Cut the monochrome emoji face down to the emoji the app can actually show.
//
//   Source:  assets/font/NotoEmoji[wght].ttf   (Google's Noto Emoji, the
//            monochrome one, variable 300–700, from google/fonts at
//            6157dfaa640ca5738b4d1a7070fe389c3036d7fc, ofl/notoemoji/)
//   Output:  src/assets/font/NotoEmoji-Subset.woff2
//   Run:     pnpm generate:emoji-font
//
// The full face is 2 MB, every byte of it in the offline precache. The app
// only ever shows the emoji named in the files below (the category glyphs and
// the playlist presets, which is also every emoji a playlist can be given),
// so those are the only glyphs kept. Re-run whenever either list changes; an
// emoji missing from the subset still shows, just in the system's colour face.
//
// Needs uv (https://docs.astral.sh/uv/): pyftsubset runs through uvx, so
// there is nothing to install.
/* global console */
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets/font/NotoEmoji[wght].ttf');
const OUT = path.join(root, 'src/assets/font/NotoEmoji-Subset.woff2');

// Every file that defines an emoji the app renders.
const EMOJI_SOURCES = ['src/utils/categoryEmoji.ts', 'src/components/playlist/EmojiPicker.vue'];

// A pictograph plus whatever rides along with it: the emoji-presentation
// selector (U+FE0F) and ZWJ joins to further pictographs (🧑‍🤝‍🧑).
const EMOJI = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;

const emoji = new Set();
for (const file of EMOJI_SOURCES) {
    const text = await readFile(path.join(root, file), 'utf8');
    for (const [match] of text.matchAll(EMOJI)) emoji.add(match);
}

const codepoints = new Set();
for (const e of emoji) for (const ch of e) codepoints.add(ch.codePointAt(0));
const unicodes = [...codepoints].map((cp) => cp.toString(16).toUpperCase().padStart(4, '0'));

execFileSync(
    'uvx',
    [
        '--from',
        'fonttools[woff]',
        'pyftsubset',
        SRC,
        `--unicodes=${unicodes.join(',')}`,
        // Every GSUB feature: the ZWJ sequences are ligatures, and a subset
        // without them draws 🧑‍🤝‍🧑 as three separate people.
        '--layout-features=*',
        '--flavor=woff2',
        `--output-file=${OUT}`,
    ],
    { stdio: 'inherit' },
);

const { size } = await stat(OUT);
console.log(
    `${emoji.size} emoji, ${codepoints.size} codepoints → ${path.relative(root, OUT)} (${(size / 1024).toFixed(1)} KB)`,
);
