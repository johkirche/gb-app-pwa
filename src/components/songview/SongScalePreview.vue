<template>
    <!-- A sample of the song page at the chosen size, and a true one: it runs
         the page's own arithmetic (see SongPage's .song-content), so the type
         under the notes here is the type under the notes there. The container
         query is what makes that possible — the size is a share of the column
         the notation gets, and this box stands in for that column. -->
    <div class="scale-preview" :style="{ '--text-scale': scale }">
        <!-- Centred by flex rather than by margins, so a staff grown past the
             box overflows to both sides and is clipped on both — the way the
             real notation spreads out of its column until the page runs out of
             width to give and the rest goes off-screen. -->
        <div class="scale-stage">
            <svg
                class="scale-notation"
                viewBox="0 0 132 54"
                role="img"
                aria-hidden="true"
                preserveAspectRatio="xMidYMid meet"
            >
                <g class="preview-staff">
                    <line
                        v-for="line in 5"
                        :key="line"
                        x1="4"
                        :y1="staffY(line)"
                        x2="128"
                        :y2="staffY(line)"
                    />
                </g>

                <g v-for="note in NOTES" :key="note.syllable" class="preview-note">
                    <ellipse
                        :cx="note.x"
                        :cy="note.y"
                        rx="3.8"
                        ry="2.9"
                        :transform="`rotate(-20 ${note.x} ${note.y})`"
                    />
                    <rect :x="note.x + 2.7" :y="note.y - 15" width="1.3" height="15" />
                    <text :x="note.x" y="49">{{ note.syllable }}</text>
                </g>
            </svg>
        </div>

        <p class="scale-verse">So groß steht die Strophe auf der Liedseite.</p>
    </div>
</template>

<script setup lang="ts">
defineProps<{ scale: number }>();

// The phrase the other song-page previews use, so all three read as one page.
const NOTES = [
    { x: 32, y: 30, syllable: 'Lo' },
    { x: 68, y: 25, syllable: 'be' },
    { x: 104, y: 20, syllable: 'singt' },
] as const;

/** Five lines, four spaces of five units, the top one at y = 15 */
function staffY(line: number): number {
    return 10 + line * 5;
}
</script>

<style scoped>
/* SongPage's contract, restated against this box: the verses are set at the
   size of the lyrics under the notes, which is a share of the notation's own
   width, which the scale multiplies. */
.scale-preview {
    container-type: inline-size;
    --notation-width: min(100cqw, var(--notation-max));
    --verse-font-size: calc(var(--notation-width) / var(--verse-measure) * var(--text-scale, 1));
}

.scale-stage {
    display: flex;
    justify-content: center;
    overflow: hidden;
}

/* The staff is NOT drawn at the box's width: three notes stretched across a
   settings pane would be a picture of nothing. Its 9-unit syllables are the
   page's verse type, so pinning those to --verse-font-size draws the whole
   phrase at the proportion the printed page keeps between notes and words. */
.scale-notation {
    flex: 0 0 auto;
    display: block;
    width: calc(var(--verse-font-size) / 9 * 132);
    height: auto;
    color: var(--foreground);
}

.preview-staff line {
    stroke: currentColor;
    stroke-width: 0.8;
    opacity: 0.3;
}

.preview-note {
    fill: currentColor;
}

.preview-note text {
    font-family: var(--font-hymnal);
    font-size: 9px;
    text-anchor: middle;
}

.scale-verse {
    margin: 0.5rem 0 0;
    font-family: var(--font-hymnal);
    font-size: var(--verse-font-size);
    line-height: 1.35;
    text-align: center;
    text-wrap: balance;
    color: var(--foreground);
}
</style>
