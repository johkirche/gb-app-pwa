/**
 * How long the Gesangbuch keeps opening without reaching the server.
 *
 * A session lasts thirty days from the last time the device reached the server
 * (REFRESH_TOKEN_TTL), and every open with a connection starts the thirty days
 * again. A device that stays offline past them is not locked at once: the book
 * keeps opening for NACHFRIST_TAGE more, because the reader may be sitting in a
 * service without a network, where no code can be had. With a connection the
 * server decides again; a session it has let run out then asks for a code,
 * which can be had there and then.
 *
 * A week before the thirty days are up, and through the grace that follows,
 * the app says so once a day (App.vue), so that nobody is locked out by
 * surprise.
 *
 * Nothing here is a lock against someone set on getting round it: the device's
 * clock decides. It is trust in the reader, with a reminder.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Days the book keeps opening offline after the session has run out. */
export const NACHFRIST_TAGE = 14;

/** Days before the session runs out that the reminder starts. */
export const VORWARNUNG_TAGE = 7;

export type OfflineFrist =
    /** Nothing to say: a session with time left, or none known. */
    | { state: 'ok' }
    /** The session runs out on `sessionEnd`; a connection before then renews it. */
    | { state: 'bald'; sessionEnd: number; lockAt: number }
    /** The session has run out; offline the book still opens until `lockAt`. */
    | { state: 'nachfrist'; sessionEnd: number; lockAt: number }
    /** Past the grace too: the book asks for a code. */
    | { state: 'vorbei' };

/** Where a device stands, given when its session runs out (ms since 1970). */
export function offlineFrist(sessionEnd: number | undefined, now = Date.now()): OfflineFrist {
    if (typeof sessionEnd !== 'number') return { state: 'ok' };
    const lockAt = sessionEnd + NACHFRIST_TAGE * DAY;
    if (now >= lockAt) return { state: 'vorbei' };
    if (now >= sessionEnd) return { state: 'nachfrist', sessionEnd, lockAt };
    if (now >= sessionEnd - VORWARNUNG_TAGE * DAY) return { state: 'bald', sessionEnd, lockAt };
    return { state: 'ok' };
}

const datum = (ms: number) =>
    new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

/** The reminder, in German, or null when there is nothing to say. */
export function fristHinweis(frist: OfflineFrist): { title: string; description: string } | null {
    switch (frist.state) {
        case 'bald':
            return {
                title: 'Das Gesangbuch braucht bald einmal Internet.',
                description: `Öffnen Sie es bis zum ${datum(frist.sessionEnd)} einmal mit Internetverbindung, dann geht es ohne Unterbrechung weiter.`,
            };
        case 'nachfrist':
            return {
                title: 'Das Gesangbuch war lange nicht mit dem Internet verbunden.',
                description: `Ohne Internet können Sie noch bis zum ${datum(frist.lockAt)} darin lesen. Mit Internet fragt es einmal nach einem Code per E-Mail.`,
            };
        default:
            return null;
    }
}
