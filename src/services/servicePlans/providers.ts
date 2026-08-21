import type { ServicePlanOfferGroup, ServicePlanProvider } from './types';

const providers = new Map<string, ServicePlanProvider>();

/**
 * Make a source of ready-made plans available to the picker. Registering the
 * same id twice replaces the earlier one, so a provider can be swapped out
 * (e.g. a Directus provider taking over from a stub) without a restart.
 */
export function registerServicePlanProvider(provider: ServicePlanProvider): void {
    providers.set(provider.id, provider);
}

export function getServicePlanProvider(id: string): ServicePlanProvider | null {
    return providers.get(id) ?? null;
}

export function listServicePlanProviders(): ServicePlanProvider[] {
    return [...providers.values()];
}

/**
 * Everything currently on offer, grouped by provider and in registration order.
 *
 * A provider that is unavailable, fails or has nothing simply does not appear:
 * the picker is an offer, not a promise, and an unreachable backend must never
 * be the reason a member cannot mark today's songs.
 */
export async function collectServicePlanOffers(): Promise<ServicePlanOfferGroup[]> {
    const groups = await Promise.all(
        listServicePlanProviders().map(async (provider) => {
            try {
                if (!(await provider.isAvailable())) return null;
                const offers = await provider.listOffers();
                return offers.length ? { provider, offers } : null;
            } catch (err) {
                console.warn(`Service plan provider "${provider.id}" failed to list offers:`, err);
                return null;
            }
        }),
    );

    return groups.filter((group): group is ServicePlanOfferGroup => group !== null);
}
