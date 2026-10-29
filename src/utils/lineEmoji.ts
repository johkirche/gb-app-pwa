/**
 * Prepares an emoji for the line-drawn emoji face (`font-emoji`, Noto Emoji).
 *
 * Many emoji are written with U+FE0F, the selector that asks for the colour
 * presentation (🕊️, ✝️, ☀️, ❤️ …). Chromium and Firefox honour it by going
 * straight to the system's colour face, past a font-family that has the glyph;
 * without it they take the first face that does, as WebKit already does.
 *
 * Display only: what is stored keeps its selector, so a playlist's emoji still
 * equals the picker's and exports exactly as before.
 */
export function lineEmoji(emoji: string): string {
    return emoji.replace(/️/g, '');
}
