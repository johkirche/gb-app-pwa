import { directusConfig } from '@/services/directus';

/**
 * The organisation's part of the Impressum and the Datenschutzerklärung: the
 * `rechtstexte` singleton in Directus, set up by gb-scripts
 * (app/33-setup-rechtstexte.py) and filled in by the organisation there.
 *
 * Read without a token: the pages open before the login, and the Public
 * policy carries the read — an expired session must not stand in the way of
 * an Impressum.
 */

export interface Rechtstexte {
    impressum_anbieter: string | null;
    impressum_anschrift: string | null;
    impressum_vertretung: string | null;
    impressum_telefon: string | null;
    impressum_register: string | null;
    impressum_verantwortlich: string | null;
    datenschutz_verantwortlicher: string | null;
    datenschutz_rechtliches: string | null;
    /** ISO date the texts apply from */
    stand: string | null;
}

export const RECHTSTEXTE_FIELDS: (keyof Rechtstexte)[] = [
    'impressum_anbieter',
    'impressum_anschrift',
    'impressum_vertretung',
    'impressum_telefon',
    'impressum_register',
    'impressum_verantwortlich',
    'datenschutz_verantwortlicher',
    'datenschutz_rechtliches',
    'stand',
];

/** Only the known fields, each a string or null — whatever else the row holds. */
export function toRechtstexte(raw: unknown): Rechtstexte {
    const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return Object.fromEntries(
        RECHTSTEXTE_FIELDS.map((key) => {
            const value = row[key];
            return [key, typeof value === 'string' && value.trim() ? value.trim() : null];
        }),
    ) as unknown as Rechtstexte;
}

export async function fetchRechtstexte(): Promise<Rechtstexte> {
    const response = await fetch(
        `${directusConfig.url}/items/rechtstexte?fields=${RECHTSTEXTE_FIELDS.join(',')}`,
    );
    if (!response.ok) throw new Error(`Rechtstexte: ${response.status} ${response.statusText}`);
    const body = (await response.json()) as { data?: unknown };
    return toRechtstexte(body.data);
}
