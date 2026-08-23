import {
    type EffectScope,
    type MaybeRefOrGetter,
    effectScope,
    onScopeDispose,
    shallowReactive,
    toValue,
    watchEffect,
} from 'vue';

import {
    engageMediaAnchor,
    releaseMediaAnchor,
    suspendMediaAnchor,
} from '@/services/mediaSessionAnchor';

/**
 * What the phone shows on its lock screen while a hymn plays, and what its
 * buttons do.
 *
 * Written source-agnostically on purpose. `navigator.mediaSession` is one
 * object per document — the last writer wins and silently overwrites whoever
 * wrote before — so the players this app is growing (the MusicXML transport
 * today, the MIDI sequence player of #29/#30, the Gottesdienst-Modus of #32
 * driving whole services) must not each poke at it. They register a source
 * here instead; this module decides who owns the session and is the only place
 * that touches the API.
 *
 * Ownership rule: the most recently registered source whose state is not
 * `'none'` owns the session. A source that is not playing therefore claims
 * nothing — a song page merely being open never takes the lock screen off
 * whatever was playing before — and a player that starts inside a screen that
 * already has one (a MIDI transport on the song page) takes over cleanly and
 * hands back when it unmounts.
 */

export type NowPlayingState = MediaSessionPlaybackState;

export interface NowPlaying {
    /** Carry the hymn number: it is how a reader recognises the song. */
    title: string;
    artist?: string;
    album?: string;
    /** Defaults to the app icon. */
    artwork?: MediaImage[];
}

export interface NowPlayingPosition {
    /** Seconds played. */
    position: number;
    /** Seconds the whole thing lasts at the current tempo. */
    duration: number;
    playbackRate?: number;
}

/**
 * Handlers for the platform's transport buttons. Only the ones given are
 * offered; the rest are cleared, so a previous owner's buttons can never be
 * left behind pointing at a player that is gone.
 *
 * `previoustrack` / `nexttrack` are unused today and are exactly what the
 * Gottesdienst-Modus needs to step through an order of service from the lock
 * screen — hence the full action set rather than play/pause/stop.
 */
export type NowPlayingHandlers = Partial<Record<MediaSessionAction, MediaSessionActionHandler>>;

export interface MediaSessionSource {
    metadata: MaybeRefOrGetter<NowPlaying | null>;
    state: MaybeRefOrGetter<NowPlayingState>;
    position?: MaybeRefOrGetter<NowPlayingPosition | null>;
    handlers: NowPlayingHandlers;
}

const ACTIONS: MediaSessionAction[] = [
    'play',
    'pause',
    'stop',
    'seekto',
    'seekbackward',
    'seekforward',
    'previoustrack',
    'nexttrack',
];

const APP_ARTWORK: MediaImage[] = [
    {
        src: `${import.meta.env.BASE_URL}pwaicons/android/android-launchericon-192-192.png`,
        sizes: '192x192',
        type: 'image/png',
    },
    {
        src: `${import.meta.env.BASE_URL}pwaicons/android/android-launchericon-512-512.png`,
        sizes: '512x512',
        type: 'image/png',
    },
];

/** The song page's position ticks with the animation frame; the lock screen
 *  runs its own clock off what it is told, so telling it 60 times a second is
 *  pure cost. A quarter of a second is finer than any platform draws. */
const POSITION_EPSILON = 0.25;

const sources = shallowReactive<MediaSessionSource[]>([]);
let scope: EffectScope | null = null;
let appliedPosition: NowPlayingPosition | null = null;

export function isMediaSessionSupported(): boolean {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

function owner(): MediaSessionSource | null {
    for (let i = sources.length - 1; i >= 0; i--) {
        if (toValue(sources[i].state) !== 'none') return sources[i];
    }
    return null;
}

function setHandlers(handlers: NowPlayingHandlers) {
    for (const action of ACTIONS) {
        try {
            navigator.mediaSession.setActionHandler(action, handlers[action] ?? null);
        } catch {
            // The platform does not know this action — nothing to offer, and
            // nothing to clean up either.
        }
    }
}

function clearSession() {
    if (!isMediaSessionSupported()) return;
    const session = navigator.mediaSession;
    session.metadata = null;
    session.playbackState = 'none';
    setHandlers({});
    try {
        session.setPositionState();
    } catch {
        // ignore
    }
    appliedPosition = null;
    releaseMediaAnchor();
}

/** Metadata, state and buttons — everything that changes rarely. */
function applyNowPlaying() {
    const active = owner();
    if (!active) {
        clearSession();
        return;
    }

    const session = navigator.mediaSession;
    const meta = toValue(active.metadata);
    session.metadata = meta
        ? new MediaMetadata({
              title: meta.title,
              artist: meta.artist ?? '',
              album: meta.album ?? '',
              artwork: meta.artwork ?? APP_ARTWORK,
          })
        : null;

    const state = toValue(active.state);
    session.playbackState = state;
    setHandlers(active.handlers);

    if (state === 'playing') engageMediaAnchor();
    else suspendMediaAnchor();
}

/** The scrub position, which changes on every frame. */
function applyPosition() {
    const active = owner();
    const next = active ? toValue(active.position) : null;
    if (!next || !(next.duration > 0)) {
        appliedPosition = null;
        return;
    }

    const rate = next.playbackRate ?? 1;
    const position = Math.max(0, Math.min(next.duration, next.position));
    const last = appliedPosition;
    if (
        last &&
        last.duration === next.duration &&
        last.playbackRate === rate &&
        Math.abs(last.position - position) < POSITION_EPSILON
    ) {
        return;
    }

    try {
        navigator.mediaSession.setPositionState({
            duration: next.duration,
            position,
            playbackRate: rate,
        });
        appliedPosition = { duration: next.duration, position, playbackRate: rate };
    } catch {
        // Some platforms reject rates or durations they dislike; the controls
        // simply show no progress then.
        appliedPosition = null;
    }
}

function ensureScope() {
    if (scope) return;
    // Detached: this outlives any single component, and the last source to
    // unregister stops it.
    scope = effectScope(true);
    scope.run(() => {
        watchEffect(applyNowPlaying);
        watchEffect(applyPosition);
    });
}

/**
 * Offer this component's playback to the platform for as long as it is
 * mounted. Everything is a no-op where the API is missing.
 *
 * ```ts
 * useMediaSession({
 *     metadata: () => ({ title: `${song.index}. ${song.titel}` }),
 *     state: () => (isPlaying.value ? 'playing' : 'paused'),
 *     handlers: { play: start, pause: pause, stop: stop },
 * });
 * ```
 */
export function useMediaSession(source: MediaSessionSource): { isSupported: boolean } {
    if (!isMediaSessionSupported()) return { isSupported: false };

    sources.push(source);
    ensureScope();

    onScopeDispose(() => {
        const index = sources.indexOf(source);
        if (index >= 0) sources.splice(index, 1);
        if (sources.length === 0) {
            scope?.stop();
            scope = null;
            clearSession();
        }
    }, true);

    return { isSupported: true };
}
