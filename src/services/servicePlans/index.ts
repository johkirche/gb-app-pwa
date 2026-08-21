import { playlistServicePlanProvider } from './playlistProvider';
import { registerServicePlanProvider } from './providers';

// Built-in providers. A Directus-backed one registers itself here too, once the
// backend publishes orders of service — nothing else has to change.
registerServicePlanProvider(playlistServicePlanProvider);

export * from './plan';
export * from './providers';
export type * from './types';
export { playlistServicePlanProvider };
