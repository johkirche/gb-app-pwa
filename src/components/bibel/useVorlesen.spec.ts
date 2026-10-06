import { effectScope } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { germanVoice, useVorlesen } from './useVorlesen';

/** A stand-in voice: it keeps what it was asked to say, and says it on cue. */
class FakeUtterance {
    lang = '';
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    constructor(public text: string) {}
}

let spoken: FakeUtterance[] = [];
const synth = {
    speak: vi.fn((utterance: FakeUtterance) => void spoken.push(utterance)),
    // As the browser does: a cancelled utterance still reports in.
    cancel: vi.fn(() => {
        const pending = spoken;
        spoken = [];
        for (const utterance of pending) utterance.onerror?.({ error: 'interrupted' });
    }),
    getVoices: () => [
        { lang: 'en-US', name: 'English' },
        { lang: 'de-DE', name: 'Deutsch' },
    ],
};

/** Let the voice finish the verse it is reading. */
function finishVerse() {
    const current = spoken.shift();
    current?.onend?.();
}

const verses = [
    { verse: 1, text: 'Der HERR ist mein Hirte;' },
    { verse: 2, text: 'er läßt mich lagern auf grünen Auen' },
];

describe('useVorlesen', () => {
    beforeEach(() => {
        spoken = [];
        vi.stubGlobal('speechSynthesis', synth);
        vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('reads verse by verse in German, following along, and ends by itself', () => {
        const scope = effectScope();
        const vorlesen = scope.run(() => useVorlesen())!;

        vorlesen.start(verses);
        expect(vorlesen.status.value).toBe('speaking');
        expect(vorlesen.verse.value).toBe(1);
        expect(spoken[0].text).toBe('Der HERR ist mein Hirte;');
        expect(spoken[0].lang).toBe('de-DE');
        expect(spoken[0].voice).toMatchObject({ name: 'Deutsch' });

        finishVerse();
        expect(vorlesen.verse.value).toBe(2);

        finishVerse();
        expect(vorlesen.status.value).toBe('idle');
        expect(vorlesen.verse.value).toBeNull();
        scope.stop();
    });

    it('starts the paused verse over on resuming', () => {
        const scope = effectScope();
        const vorlesen = scope.run(() => useVorlesen())!;

        vorlesen.start(verses);
        finishVerse();
        vorlesen.pause();
        expect(vorlesen.status.value).toBe('paused');
        expect(vorlesen.verse.value).toBe(2);
        expect(spoken).toHaveLength(0);

        vorlesen.resume();
        expect(vorlesen.status.value).toBe('speaking');
        expect(spoken.map((utterance) => utterance.text)).toEqual([verses[1].text]);
        scope.stop();
    });

    it('falls silent when the page goes away', () => {
        const scope = effectScope();
        const vorlesen = scope.run(() => useVorlesen())!;

        vorlesen.start(verses);
        scope.stop();
        expect(synth.cancel).toHaveBeenCalled();
        expect(vorlesen.status.value).toBe('idle');
    });
});

describe('germanVoice', () => {
    const voice = (name: string, lang: string, localService: boolean) =>
        ({ name, lang, localService }) as SpeechSynthesisVoice;

    it('takes a German voice on the device before one online', () => {
        const online = voice('Google Deutsch', 'de-DE', false);
        const device = voice('Microsoft Katja', 'de-DE', true);
        expect(germanVoice([online, device])).toBe(device);
    });

    it('takes any German voice on the device before a de-DE one online', () => {
        const online = voice('Google Deutsch', 'de-DE', false);
        const swiss = voice('Leni', 'de-CH', true);
        expect(germanVoice([online, swiss])).toBe(swiss);
    });

    it('falls back to an online voice only where the device has no German one', () => {
        const online = voice('Google Deutsch', 'de-DE', false);
        expect(germanVoice([voice('Samantha', 'en-US', true), online])).toBe(online);
        expect(germanVoice([voice('Samantha', 'en-US', true)])).toBeNull();
    });
});
