import type { ServiceEntry } from '@/db';

/**
 * A plan a provider has on offer, as it is shown in the picker. Deliberately
 * flat and free of song data: listing must stay cheap enough to run every time
 * the panel opens, including over the network.
 */
export interface ServicePlanOffer {
    /** Stable within its provider. */
    id: string;
    title: string;
    /** ISO `yyyy-mm-dd` of the service day, when the provider knows it. */
    date?: string | null;
    /** One line under the title. */
    subtitle?: string | null;
    /** The offer's mark in the list; providers without one fall back to an icon. */
    emoji?: string | null;
    songCount: number;
}

/** What a provider hands back for an offer — the plan before it is stored. */
export interface ServicePlanDraft {
    title: string;
    /** Omitted means "today"; the store fills it in. */
    date?: string | null;
    entries: ServiceEntry[];
}

/**
 * A source of ready-made service plans.
 *
 * The app ships one implementation (playlists on this device). The Directus
 * backend is meant to arrive as a second one: publish an order of service
 * there, implement `listOffers`/`loadOffer` against it, register it — and the
 * picker, the store and the Gottesdienst page pick it up without a change.
 * Everything a provider returns is therefore expressed in local song ids: it is
 * the provider's job to map whatever the source uses onto the hymnal as this
 * device knows it, and to drop what it cannot map.
 */
export interface ServicePlanProvider {
    /** Also stored on an adopted plan (`ServicePlanOrigin.providerId`). */
    id: string;
    /** Heading for this provider's group in the picker. */
    label: string;
    /** Optional line under the heading. */
    description?: string;
    /**
     * Whether the provider can offer anything right now — no playlists yet, no
     * network, backend not configured. Returning false hides the group; it must
     * not throw.
     */
    isAvailable(): boolean | Promise<boolean>;
    /** What is on offer. Failures are the caller's to absorb, not the user's. */
    listOffers(): Promise<ServicePlanOffer[]>;
    /** Resolve one offer into a plan. `null` when the offer is gone. */
    loadOffer(offerId: string): Promise<ServicePlanDraft | null>;
}

/** One provider's offers, as the picker renders them. */
export interface ServicePlanOfferGroup {
    provider: ServicePlanProvider;
    offers: ServicePlanOffer[];
}
