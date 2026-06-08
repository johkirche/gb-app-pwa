// Regenerate all PWA / favicon / app-icon assets from the source logo.
//
//   Source:  assets/logo/logo.svg   (gradient line-art, viewBox 0 0 686 677)
//   Run:     pnpm generate:icons
//
// Re-run whenever assets/logo/logo.svg changes. Everything below is derived,
// so the generated files should never be hand-edited.
import { Buffer } from 'node:buffer';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets/logo/logo.svg');
const PUB = path.join(root, 'public');
const ANDROID = path.join(PUB, 'pwaicons/android');

// ---------------------------------------------------------------- config ----
// The established look is a transparent background with the gradient line-art.
// Flip TRANSPARENT to a hex string (e.g. '#ffffff') to put icons on a solid bg.
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const ICON_BG = TRANSPARENT; // standard app icons / favicons
const MASKABLE_BG = '#ffffff'; // Android maskable must be opaque (safe-zone fill)
// iOS composites transparent apple-touch-icons onto black, so give it a solid bg.
const APPLE_BG = '#ffffff';

const PAD = 0.06; // app icons: logo fills ~88% of the canvas
const FAVICON_PAD = 0.04; // small favicons: a touch more bleed for legibility
const MASKABLE_PAD = 0.2; // Android adaptive safe-zone (logo fills ~60%)

// ------------------------------------------------------------- rendering ----
const svg = await readFile(SRC, 'utf8');
// Black monochrome variant: swap the gradient fill for solid black.
const svgBlack = svg.replace(/url\(#_Linear1\)/g, '#000000');

/** Render an SVG string to a centered, padded SIZE×SIZE PNG buffer. */
async function renderIcon(svgStr, size, { pad = PAD, bg = ICON_BG } = {}) {
    const inner = Math.round(size * (1 - 2 * pad));
    // ~2x supersample so downscaled edges stay crisp at every size.
    const density = Math.max(96, Math.ceil(size * 0.3));
    const logo = await sharp(Buffer.from(svgStr), { density })
        .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
        .png()
        .toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
        .composite([{ input: logo, gravity: 'center' }])
        .png()
        .toBuffer();
}

/** Render the logo at its native aspect ratio (no square padding). */
async function renderNative(svgStr, width) {
    const density = Math.max(96, Math.ceil(width * 0.4));
    return sharp(Buffer.from(svgStr), { density })
        .resize({ width, fit: 'inside' })
        .png()
        .toBuffer();
}

async function write(file, buf) {
    await writeFile(file, buf);
    const { width, height } = await sharp(buf).metadata();
    console.log(`  ${path.relative(root, file).replace(/\\/g, '/')}  ${width}x${height}`);
}

// ----------------------------------------------------------------- build ----
await mkdir(ANDROID, { recursive: true });

console.log('logo (served in-app):');
await copyFile(SRC, path.join(PUB, 'logo.svg'));
console.log(`  public/logo.svg  (copied)`);
await write(path.join(PUB, 'logo.png'), await renderNative(svg, 686));
await write(path.join(PUB, 'logo-black.png'), await renderNative(svgBlack, 686));

console.log('favicons:');
const fav16 = await renderIcon(svg, 16, { pad: FAVICON_PAD });
const fav32 = await renderIcon(svg, 32, { pad: FAVICON_PAD });
const fav48 = await renderIcon(svg, 48, { pad: FAVICON_PAD });
await write(path.join(PUB, 'favicon-16x16.png'), fav16);
await write(path.join(PUB, 'favicon-32x32.png'), fav32);
await write(path.join(PUB, 'favicon.png'), fav48);
await writeFile(path.join(PUB, 'favicon.ico'), await pngToIco([fav16, fav32, fav48]));
console.log('  public/favicon.ico  (16/32/48)');

console.log('apple / android-chrome:');
await write(
    path.join(PUB, 'apple-touch-icon.png'),
    await renderIcon(svg, 180, { pad: 0.1, bg: APPLE_BG }),
);
await write(path.join(PUB, 'android-chrome-192x192.png'), await renderIcon(svg, 192));
await write(path.join(PUB, 'android-chrome-512x512.png'), await renderIcon(svg, 512));

console.log('pwa manifest icons (pwaicons/android):');
for (const s of [48, 72, 96, 144, 192, 512]) {
    await write(path.join(ANDROID, `android-launchericon-${s}-${s}.png`), await renderIcon(svg, s));
}
// Dedicated maskable icon: opaque bg + safe-zone padding (referenced in manifest).
await write(
    path.join(ANDROID, 'maskable-512.png'),
    await renderIcon(svg, 512, { pad: MASKABLE_PAD, bg: MASKABLE_BG }),
);

console.log('\nDone.');
