import { thisDevice } from '@/services/device';
import { directusClient, directusConfig } from '@/services/directus';

/**
 * The way in: the register extension's routes for signing in by a code sent to
 * the address, registering with an Aktivierungscode, the password, and the
 * devices an account is on (see directus-user-register-extension, README).
 *
 * The routes that give out a session are sent with plain fetch and no
 * Authorization header. Directus checks a bearer before it routes a request,
 * so a dead token sent along would have them refused before they are looked at
 * (see services/session.ts). Only the device list, signing a device out and
 * setting a password need the session, and go through the client.
 */

const EXTENSION = '/directus-user-register-extension';

/** What every session-giving route answers with. */
export interface Session {
    access_token: string;
    refresh_token: string;
    /** The access token's lifetime, in ms. */
    expires: number;
    /** When the session runs out unless renewed, in ms since 1970. */
    refresh_expires?: number | null;
}

export interface Device {
    id: number;
    name: string;
    last_seen: string;
    signed_in: string;
    current: boolean;
}

/**
 * A refusal, by the extension's code (`CODE_INVALID`, `DEVICE_LIMIT` …), with
 * what it carried along (`attempts_left`, `retry_after`, `devices`, `ticket` …).
 * `NETWORK` when nothing came back at all.
 */
export class EinstiegError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
        readonly extensions: Record<string, unknown> = {},
        message = code,
    ) {
        super(message);
        this.name = 'EinstiegError';
    }

    get attemptsLeft(): number | null {
        const left = this.extensions.attempts_left;
        return typeof left === 'number' ? left : null;
    }

    get retryAfter(): number | null {
        const seconds = this.extensions.retry_after;
        return typeof seconds === 'number' ? seconds : null;
    }
}

/** The account has no room for this device: what to offer instead. */
export interface DeviceLimit {
    limit: number;
    devices: Device[];
    ticket: string;
}

export function deviceLimitOf(error: unknown): DeviceLimit | null {
    if (!(error instanceof EinstiegError) || error.code !== 'DEVICE_LIMIT') return null;
    const { limit, devices, ticket } = error.extensions as Partial<DeviceLimit>;
    if (typeof ticket !== 'string' || !Array.isArray(devices)) return null;
    return { limit: typeof limit === 'number' ? limit : devices.length, devices, ticket };
}

async function refusal(response: Response): Promise<EinstiegError> {
    let first: { message?: string; extensions?: Record<string, unknown> } | undefined;
    try {
        first = (await response.json())?.errors?.[0];
    } catch {
        // Not JSON: a proxy's error page, say.
    }
    const extensions = first?.extensions ?? {};
    const code = typeof extensions.code === 'string' ? extensions.code : `HTTP_${response.status}`;
    return new EinstiegError(code, response.status, extensions, first?.message ?? code);
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${directusConfig.url}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch {
        throw new EinstiegError('NETWORK', 0);
    }
    if (!response.ok) throw await refusal(response);
    return (await response.json()) as T;
}

/** Whether the server answered as if the route did not exist: an older extension. */
function isMissingRoute(error: unknown): boolean {
    return (
        error instanceof EinstiegError && (error.code === 'ROUTE_NOT_FOUND' || error.status === 404)
    );
}

/** Sends a six-digit code to the address. Answers alike whether it has an account or not. */
export async function requestCode(email: string): Promise<{ expiresIn: number; resendIn: number }> {
    const { data } = await post<{ data: { expires_in: number; resend_in: number } }>(
        `${EXTENSION}/code`,
        { email },
    );
    return { expiresIn: data.expires_in, resendIn: data.resend_in };
}

export type CodeOutcome =
    | { result: 'signed_in'; session: Session }
    | { result: 'needs_registration'; ticket: string };

/** Checks the code: a session, or a ticket for an address that has no account yet. */
export async function checkCode(email: string, code: string): Promise<CodeOutcome> {
    const { data } = await post<{
        data:
            | ({ result: 'signed_in' } & Session)
            | { result: 'needs_registration'; ticket: string };
    }>(`${EXTENSION}/code/pruefen`, { email, code, geraet: thisDevice() });
    if (data.result === 'needs_registration') return { result: data.result, ticket: data.ticket };
    const { result, ...session } = data;
    return { result, session };
}

/** Makes the account from a ticket and an Aktivierungscode, and signs it in. */
export async function registerWithTicket(
    ticket: string,
    registrationCode: string,
): Promise<Session> {
    const { data } = await post<{ data: Session }>(`${EXTENSION}/register`, {
        ticket,
        registration_code: registrationCode,
        geraet: thisDevice(),
    });
    return data;
}

/**
 * The password way in, this device counted. Falls back to Directus' own login
 * where the extension does not have the route yet, so the password keeps
 * working whichever of the two is deployed first.
 */
export async function loginWithPassword(email: string, password: string): Promise<Session> {
    try {
        const { data } = await post<{ data: Session }>(`${EXTENSION}/login`, {
            email,
            password,
            geraet: thisDevice(),
        });
        return data;
    } catch (error) {
        if (!isMissingRoute(error)) throw error;
        const { data } = await post<{ data: Session }>('/auth/login', {
            email,
            password,
            mode: 'json',
        });
        return data;
    }
}

/** Signs out one of the account's devices and this one in, with the ticket DEVICE_LIMIT gave. */
export async function swapDevice(ticket: string, signOut: number): Promise<Session> {
    const { data } = await post<{ data: { result: 'signed_in' } & Session }>(
        `${EXTENSION}/geraete/tauschen`,
        { ticket, abmelden: signOut, geraet: thisDevice() },
    );
    const { result: _result, ...session } = data;
    return session;
}

// The Directus client hands back a custom route's `data` when there is one.
function unwrap<T>(answer: unknown): T {
    const object = answer as { data?: T } | null;
    return (object && typeof object === 'object' && 'data' in object ? object.data : answer) as T;
}

/** The account's devices, this one marked `current`. */
export async function listDevices(): Promise<{ limit: number; devices: Device[] }> {
    const id = encodeURIComponent(thisDevice().id);
    const answer = await directusClient.request(() => ({
        path: `${EXTENSION}/geraete?geraet=${id}`,
        method: 'GET',
    }));
    return unwrap(answer);
}

export async function signOutDevice(id: number): Promise<void> {
    await directusClient.request(() => ({ path: `${EXTENSION}/geraete/${id}`, method: 'DELETE' }));
}

/** Sets the signed-in account's password; the old one is not asked for. */
export async function setPassword(password: string): Promise<void> {
    await directusClient.request(() => ({
        path: `${EXTENSION}/passwort`,
        method: 'POST',
        body: JSON.stringify({ password }),
    }));
}

/** What a refusal means for the reader, in German. */
export function describeEinstiegError(error: unknown): string {
    if (!(error instanceof EinstiegError)) {
        return 'Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.';
    }
    const minutes = (seconds: number) => {
        if (seconds < 90) return `${seconds} Sekunden`;
        const m = Math.ceil(seconds / 60);
        return m === 1 ? 'einer Minute' : `${m} Minuten`;
    };
    switch (error.code) {
        case 'NETWORK':
            return 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.';
        case 'INVALID_PAYLOAD':
            return 'Bitte prüfen Sie Ihre Eingabe.';
        case 'CODE_REQUESTED_TOO_OFTEN':
            return error.retryAfter
                ? `Bitte warten Sie noch ${minutes(error.retryAfter)}, bevor Sie einen neuen Code anfordern.`
                : 'Bitte warten Sie etwas, bevor Sie einen neuen Code anfordern.';
        case 'MAIL_FAILED':
            return 'Die E-Mail konnte gerade nicht verschickt werden. Bitte versuchen Sie es später noch einmal.';
        case 'CODE_INVALID': {
            const left = error.attemptsLeft ?? 0;
            return left > 0
                ? `Dieser Code stimmt nicht. Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}.`
                : 'Zu viele Versuche. Bitte fordern Sie einen neuen Code an.';
        }
        case 'CODE_EXPIRED':
            return 'Dieser Code gilt nicht mehr. Bitte fordern Sie einen neuen an.';
        case 'CODE_LOGIN_REFUSED':
            switch (error.extensions.reason) {
                case 'inactive':
                    return 'Dieses Konto ist gesperrt. Bitte wenden Sie sich an den Support.';
                case 'two_factor':
                    return 'Dieses Konto ist mit einem zweiten Faktor geschützt. Bitte melden Sie sich mit dem Passwort an.';
                default:
                    return 'Mit diesem Konto geht die Anmeldung per Code nicht. Bitte melden Sie sich mit dem Passwort an.';
            }
        case 'REGISTRATION_CODE_INVALID': {
            const left = error.attemptsLeft;
            if (left === 0) {
                return 'Zu viele falsche Aktivierungscodes. Bitte fordern Sie einen neuen Code per E-Mail an.';
            }
            const rest = left ? ` Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}.` : '';
            return `Dieser Aktivierungscode ist ungültig oder wurde bereits verwendet.${rest}`;
        }
        case 'REGISTRATION_TRIED_TOO_OFTEN':
            return error.retryAfter
                ? `Zu viele Versuche von diesem Netz. Bitte versuchen Sie es in ${minutes(error.retryAfter)} noch einmal.`
                : 'Zu viele Versuche von diesem Netz. Bitte versuchen Sie es später noch einmal.';
        case 'TICKET_INVALID':
            return 'Das hat zu lange gedauert. Bitte fordern Sie einen neuen Code per E-Mail an.';
        case 'USER_ALREADY_REGISTERED':
            return 'Für diese Adresse gibt es inzwischen ein Konto. Bitte melden Sie sich an.';
        case 'INVALID_CREDENTIALS':
            return 'E-Mail-Adresse oder Passwort stimmen nicht.';
        case 'INVALID_OTP':
            return 'Dieses Konto ist mit einem zweiten Faktor geschützt, den die App nicht abfragen kann.';
        case 'USER_SUSPENDED':
            return 'Dieses Konto ist gesperrt. Bitte wenden Sie sich an den Support.';
        default:
            return 'Das hat nicht geklappt. Bitte versuchen Sie es später noch einmal.';
    }
}
