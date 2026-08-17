import { describe, expect, it, vi } from 'vitest';

/**
 * Tests for the login error translation.
 *
 * `translateLoginError` — pins the German-first mapping: invalid credentials and
 * network-level failures each get their own German message, and the generic
 * fallback never echoes English backend text.
 */

// The db module instantiates Dexie at import time; the functions under test never
// touch it, so a stub keeps IndexedDB out of jsdom.
vi.mock('@/db', () => ({ db: {} }));

const { NETWORK_ERROR_MESSAGE, translateLoginError } = await import('./errorHandler');

describe('translateLoginError', () => {
    it('maps invalid credentials to the German credentials message', () => {
        expect(
            translateLoginError({
                errors: [
                    {
                        message: 'Invalid user credentials',
                        extensions: { code: 'INVALID_CREDENTIALS' },
                    },
                ],
            }),
        ).toBe('E-Mail-Adresse oder Passwort ist falsch.');
    });

    it('maps a fetch-level TypeError to the German network message', () => {
        expect(translateLoginError(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE);
    });

    it("maps Firefox's NetworkError wording to the German network message", () => {
        expect(
            translateLoginError(new Error('NetworkError when attempting to fetch a resource.')),
        ).toBe(NETWORK_ERROR_MESSAGE);
    });

    it('reports the network message while the browser is offline', () => {
        const onLine = vi.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(false);
        try {
            expect(translateLoginError({ errors: [] })).toBe(NETWORK_ERROR_MESSAGE);
        } finally {
            onLine.mockRestore();
        }
    });

    it('falls back to the generic German message instead of echoing backend text', () => {
        expect(translateLoginError({ errors: [{ message: 'Something server-side' }] })).toBe(
            'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es später erneut.',
        );
    });
});
