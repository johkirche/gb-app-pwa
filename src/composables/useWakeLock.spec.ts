import { effectScope, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { useWakeLock as useWakeLockType } from '@/composables/useWakeLock';

// Ein gefälschtes Sentinel, das sich wie das echte verhält: es kann von uns
// freigegeben werden — und vom Browser, wenn die Seite in den Hintergrund geht.
function makeSentinel() {
    const listeners = new Set<(event: Event) => void>();
    const sentinel = {
        released: false,
        type: 'screen',
        addEventListener(type: string, listener: (event: Event) => void) {
            if (type === 'release') listeners.add(listener);
        },
        removeEventListener(_type: string, listener: (event: Event) => void) {
            listeners.delete(listener);
        },
        release: vi.fn(async () => {
            sentinel.released = true;
        }),
        /** Was der Browser tut, sobald die Seite verdeckt wird. */
        fireRelease() {
            sentinel.released = true;
            for (const listener of [...listeners]) listener({ target: sentinel } as never);
        },
    };
    return sentinel;
}

let request: ReturnType<typeof vi.fn>;
let sentinels: ReturnType<typeof makeSentinel>[];
let useWakeLock: typeof useWakeLockType;
let scope: ReturnType<typeof effectScope>;

/** Die Warteschlange im Modul ist eine Promise-Kette — einmal durchlaufen lassen. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(async () => {
    vi.resetModules();
    sentinels = [];
    request = vi.fn(async () => {
        const sentinel = makeSentinel();
        sentinels.push(sentinel);
        return sentinel;
    });
    Object.defineProperty(navigator, 'wakeLock', {
        value: { request },
        configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    ({ useWakeLock } = await import('@/composables/useWakeLock'));
    scope = effectScope();
});

afterEach(() => {
    scope.stop();
    Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('useWakeLock', () => {
    it('nimmt für mehrere Halter nur ein Sentinel und gibt es erst mit dem letzten frei', async () => {
        const [songPage, service] = scope.run(() => [useWakeLock(), useWakeLock()])!;

        songPage.request();
        service.request();
        await settle();

        expect(request).toHaveBeenCalledTimes(1);
        expect(songPage.isActive.value).toBe(true);

        // Eine Seite geht — die andere singt weiter, das Display bleibt an.
        songPage.release();
        await settle();
        expect(sentinels[0].released).toBe(false);
        expect(service.isActive.value).toBe(true);

        service.release();
        await settle();
        expect(sentinels[0].released).toBe(true);
        expect(service.isActive.value).toBe(false);
    });

    it('folgt einer reaktiven Quelle und gibt beim Verlassen des Scopes frei', async () => {
        const wanted = ref(false);
        const handle = scope.run(() => useWakeLock(() => wanted.value))!;
        await settle();
        expect(request).not.toHaveBeenCalled();

        wanted.value = true;
        await settle();
        expect(request).toHaveBeenCalledTimes(1);
        expect(handle.isActive.value).toBe(true);

        scope.stop();
        await settle();
        expect(sentinels[0].released).toBe(true);
    });

    it('holt die Sperre zurück, nachdem der Browser sie im Hintergrund abgeräumt hat', async () => {
        const handle = scope.run(() => useWakeLock())!;
        handle.request();
        await settle();
        expect(request).toHaveBeenCalledTimes(1);

        // Der Browser gibt beim Verdecken selbst frei und meldet das.
        setVisibility('hidden');
        sentinels[0].fireRelease();
        await settle();
        expect(handle.isActive.value).toBe(false);
        // Im Hintergrund darf gar nicht erst angefragt werden.
        expect(request).toHaveBeenCalledTimes(1);

        setVisibility('visible');
        await settle();
        expect(request).toHaveBeenCalledTimes(2);
        expect(handle.isActive.value).toBe(true);
    });

    it('bleibt ohne Plattform-Unterstützung folgenlos', async () => {
        Reflect.deleteProperty(navigator, 'wakeLock');
        vi.resetModules();
        const module = await import('@/composables/useWakeLock');

        expect(module.isWakeLockSupported()).toBe(false);
        const handle = scope.run(() => module.useWakeLock(() => true))!;
        await settle();

        expect(handle.isSupported).toBe(false);
        expect(handle.isActive.value).toBe(false);
        expect(() => handle.release()).not.toThrow();
    });

    it('verschluckt eine abgelehnte Anfrage — Akkusparmodus ist kein Fehlerfall', async () => {
        request.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
        const handle = scope.run(() => useWakeLock())!;

        handle.request();
        await settle();

        expect(handle.isActive.value).toBe(false);
    });
});
