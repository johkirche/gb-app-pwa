/**
 * The silent track that makes the platform believe this page plays media.
 *
 * The hymns are sounded by a Web Audio scheduler (osmd-audio-player today, the
 * MIDI synthesizer of #29/#30 next), and Web Audio alone does not register as
 * media: Chrome only raises the notification, and Android only routes the
 * headset buttons, once an *element* has played audible sound. Without one,
 * `navigator.mediaSession` can be filled in perfectly and nothing appears.
 *
 * So a looping element of pure silence runs alongside the music for as long as
 * something is playing. It is the standard workaround for element-less
 * players, and it is deliberately not `muted`: a muted element is ignored by
 * the same heuristic it is here to satisfy.
 *
 * The file is synthesized rather than shipped — a second of 8-bit 8 kHz
 * silence is 8 KB of zero information, and generating it keeps the offline
 * corpus free of an asset whose only content is nothing.
 */

let element: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

function writeAscii(view: DataView, offset: number, text: string) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** One second of silence as a WAV, as an object URL. */
function createSilenceUrl(): string | null {
    if (typeof URL.createObjectURL !== 'function') return null;

    const sampleRate = 8000;
    const samples = sampleRate;
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM header length
    view.setUint16(20, 1, true); // PCM, uncompressed
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); // byte rate (1 byte per frame)
    view.setUint16(32, 1, true); // block align
    view.setUint16(34, 8, true); // bits per sample
    writeAscii(view, 36, 'data');
    view.setUint32(40, samples, true);
    // Unsigned 8-bit PCM puts silence at the middle of the range, not at zero.
    new Uint8Array(buffer, 44).fill(128);

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function ensureElement(): HTMLAudioElement | null {
    if (element) return element;
    if (typeof Audio !== 'function') return null;
    objectUrl ??= createSilenceUrl();
    if (!objectUrl) return null;

    const audio = new Audio(objectUrl);
    audio.loop = true;
    audio.preload = 'auto';
    element = audio;
    return audio;
}

/**
 * Start the silent track. Call from a path that began with a user gesture —
 * the autoplay policy applies to this element like any other, and a rejected
 * play() only costs the OS controls, never the music itself.
 */
export function engageMediaAnchor(): void {
    const audio = ensureElement();
    if (!audio || !audio.paused) return;
    void audio.play().catch(() => {
        // No platform controls this time. The hymn still plays.
    });
}

/** Hold the session while paused: the notification stays, showing "play". */
export function suspendMediaAnchor(): void {
    element?.pause();
}

/** Give the session back — nothing is playing any more. */
export function releaseMediaAnchor(): void {
    if (!element) return;
    element.pause();
    try {
        element.currentTime = 0;
    } catch {
        // Some engines refuse a seek before metadata; harmless either way.
    }
}
