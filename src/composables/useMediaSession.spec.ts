import { type EffectScope, effectScope, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NowPlayingState, useMediaSession as useMediaSessionType } from './useMediaSession';

// Der stille Anker fasst ein <audio>-Element an, das es in jsdom nicht
// sinnvoll gibt — hier zählt nur, wann er ein- und ausgeschaltet wird.
const anchor = vi.hoisted(() => ({
    engageMediaAnchor: vi.fn(),
    suspendMediaAnchor: vi.fn(),
    releaseMediaAnchor: vi.fn(),
}));
vi.mock('@/services/mediaSessionAnchor', () => anchor);

type Handlers = Record<string, unknown>;

let session: {
    metadata: unknown;
    playbackState: NowPlayingState;
    setActionHandler: ReturnType<typeof vi.fn>;
    setPositionState: ReturnType<typeof vi.fn>;
};
let handlers: Handlers;
let useMediaSession: typeof useMediaSessionType;
let scope: EffectScope;

class FakeMediaMetadata {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: unknown;
    constructor(init: Record<string, unknown> = {}) {
        Object.assign(this, init);
    }
}

beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    handlers = {};
    session = {
        metadata: null,
        playbackState: 'none',
        setActionHandler: vi.fn((action: string, handler: unknown) => {
            handlers[action] = handler;
        }),
        setPositionState: vi.fn(),
    };
    Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
    vi.stubGlobal('MediaMetadata', FakeMediaMetadata);

    ({ useMediaSession } = await import('./useMediaSession'));
    scope = effectScope();
});

afterEach(() => {
    scope.stop();
    Reflect.deleteProperty(navigator, 'mediaSession');
    vi.unstubAllGlobals();
});

describe('useMediaSession', () => {
    it('beansprucht die Sitzung erst, wenn wirklich gespielt wird', async () => {
        const state = ref<NowPlayingState>('none');
        scope.run(() =>
            useMediaSession({
                metadata: () => ({ title: '353. Rein, wenn' }),
                state,
                handlers: {},
            }),
        );
        await nextTick();

        expect(session.metadata).toBeNull();
        expect(session.playbackState).toBe('none');

        state.value = 'playing';
        await nextTick();

        expect(session.metadata).toMatchObject({ title: '353. Rein, wenn' });
        expect(session.playbackState).toBe('playing');
        expect(anchor.engageMediaAnchor).toHaveBeenCalled();
    });

    it('meldet nur die übergebenen Tasten an und räumt alle anderen ab', async () => {
        const play = vi.fn();
        scope.run(() =>
            useMediaSession({
                metadata: () => ({ title: 'Lied' }),
                state: () => 'playing',
                handlers: { play },
            }),
        );
        await nextTick();

        expect(handlers.play).toBe(play);
        expect(handlers.pause).toBeNull();
        expect(handlers.nexttrack).toBeNull();
    });

    it('pausiert den Anker, statt die Sitzung wegzugeben', async () => {
        const state = ref<NowPlayingState>('playing');
        scope.run(() =>
            useMediaSession({ metadata: () => ({ title: 'Lied' }), state, handlers: {} }),
        );
        await nextTick();

        state.value = 'paused';
        await nextTick();

        expect(session.playbackState).toBe('paused');
        expect(anchor.suspendMediaAnchor).toHaveBeenCalled();
        expect(anchor.releaseMediaAnchor).not.toHaveBeenCalled();
    });

    it('übergibt an die zuletzt angemeldete spielende Quelle und wieder zurück', async () => {
        const outerScope = effectScope();
        outerScope.run(() =>
            useMediaSession({
                metadata: () => ({ title: 'MusicXML' }),
                state: () => 'playing',
                handlers: {},
            }),
        );
        await nextTick();
        expect(session.metadata).toMatchObject({ title: 'MusicXML' });

        // Ein zweiter Spieler auf derselben Seite (später: MIDI) übernimmt.
        const midiScope = effectScope();
        midiScope.run(() =>
            useMediaSession({
                metadata: () => ({ title: 'MIDI' }),
                state: () => 'playing',
                handlers: {},
            }),
        );
        await nextTick();
        expect(session.metadata).toMatchObject({ title: 'MIDI' });

        midiScope.stop();
        await nextTick();
        expect(session.metadata).toMatchObject({ title: 'MusicXML' });

        outerScope.stop();
        await nextTick();
        expect(session.metadata).toBeNull();
        expect(session.playbackState).toBe('none');
        expect(anchor.releaseMediaAnchor).toHaveBeenCalled();
    });

    it('meldet die Position, aber nicht bei jedem Frame', async () => {
        const position = ref(0);
        scope.run(() =>
            useMediaSession({
                metadata: () => ({ title: 'Lied' }),
                state: () => 'playing',
                position: () => ({ position: position.value, duration: 90 }),
                handlers: {},
            }),
        );
        await nextTick();
        expect(session.setPositionState).toHaveBeenCalledWith({
            duration: 90,
            position: 0,
            playbackRate: 1,
        });

        // Ein Frame weiter: viel zu fein, um die Plattform damit zu behelligen.
        session.setPositionState.mockClear();
        position.value = 0.016;
        await nextTick();
        expect(session.setPositionState).not.toHaveBeenCalled();

        position.value = 1.5;
        await nextTick();
        expect(session.setPositionState).toHaveBeenCalledWith({
            duration: 90,
            position: 1.5,
            playbackRate: 1,
        });
    });

    it('bleibt ohne Media-Session-API folgenlos', async () => {
        Reflect.deleteProperty(navigator, 'mediaSession');
        vi.resetModules();
        const module = await import('./useMediaSession');

        expect(module.isMediaSessionSupported()).toBe(false);
        const handle = scope.run(() =>
            module.useMediaSession({
                metadata: () => ({ title: 'Lied' }),
                state: () => 'playing',
                handlers: {},
            }),
        )!;
        expect(handle.isSupported).toBe(false);
    });
});
