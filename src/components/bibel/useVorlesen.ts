import { onScopeDispose, readonly, ref } from 'vue';

import type { SpokenVerse } from './bibelReader';

/**
 * Vorlesen: the chapter read aloud by the device's own voice, a verse at a
 * time.
 *
 * One utterance per verse rather than one for the chapter, for two reasons:
 * the page can follow along (the verse being read is marked and kept on
 * screen), and Chrome cuts off a long utterance after a quarter of a minute or
 * so, which a chapter would always run into.
 *
 * Pausing cancels the verse and resuming starts it again, instead of
 * speechSynthesis.pause()/resume(): those do nothing on Chrome for Android and
 * leave the engine stuck on some desktop voices, while starting a verse over
 * works everywhere and costs the listener a few words at most.
 */

export type VorlesenStatus = 'idle' | 'speaking' | 'paused';

export function isVorlesenSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof window.SpeechSynthesisUtterance === 'function'
    );
}

/**
 * A German voice, the one for Germany first; null leaves it to the lang tag.
 * A voice on the device before one online: Chrome also offers its maker's
 * online voices ("Google Deutsch"), which send the text away to be spoken —
 * used only where the device has no German voice of its own (the
 * Datenschutzerklärung says so).
 */
export function germanVoice(
    voices: SpeechSynthesisVoice[] = window.speechSynthesis.getVoices(),
): SpeechSynthesisVoice | null {
    const german = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().startsWith('de');
    const pick = (list: SpeechSynthesisVoice[]) =>
        list.find((voice) => voice.lang === 'de-DE') ?? list.find(german) ?? null;
    return (
        pick(voices.filter((v) => v.localService)) ?? pick(voices.filter((v) => !v.localService))
    );
}

export function useVorlesen() {
    const isSupported = isVorlesenSupported();
    const status = ref<VorlesenStatus>('idle');
    /** The verse being read, or held at while paused. */
    const verse = ref<number | null>(null);

    let queue: SpokenVerse[] = [];
    let at = 0;
    // Every start, pause and stop opens a new run; the callbacks of an
    // utterance from an earlier one — cancel() fires them too — are ignored.
    let run = 0;

    function speakFrom(index: number, token: number) {
        if (token !== run) return;
        if (index >= queue.length) {
            stop();
            return;
        }
        at = index;
        verse.value = queue[index].verse;

        const utterance = new SpeechSynthesisUtterance(queue[index].text);
        utterance.lang = 'de-DE';
        const voice = germanVoice();
        if (voice) utterance.voice = voice;
        utterance.onend = () => speakFrom(index + 1, token);
        utterance.onerror = (event) => {
            if (token !== run) return;
            // What our own cancel() reports; the run check has it covered.
            if (event.error === 'interrupted' || event.error === 'canceled') return;
            console.error('Error reading aloud:', event.error);
            stop();
        };
        window.speechSynthesis.speak(utterance);
    }

    /** Read these verses, from the first; whatever was being read stops. */
    function start(verses: SpokenVerse[]) {
        if (!isSupported) return;
        stop();
        if (verses.length === 0) return;
        queue = verses;
        status.value = 'speaking';
        speakFrom(0, run);
    }

    function pause() {
        if (status.value !== 'speaking') return;
        run++;
        window.speechSynthesis.cancel();
        status.value = 'paused';
    }

    function resume() {
        if (status.value !== 'paused') return;
        run++;
        status.value = 'speaking';
        speakFrom(at, run);
    }

    function stop() {
        run++;
        queue = [];
        at = 0;
        status.value = 'idle';
        verse.value = null;
        if (isSupported) window.speechSynthesis.cancel();
    }

    // The voice must not read on over a page that is gone.
    onScopeDispose(stop, true);

    return {
        isSupported,
        status: readonly(status),
        verse: readonly(verse),
        start,
        pause,
        resume,
        stop,
    };
}
