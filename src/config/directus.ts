const backendUrl = import.meta.env.VITE_BACKEND_URL;

// Fail fast with an actionable message instead of the Directus SDK's cryptic
// "TypeError: Invalid URL" when no backend URL is configured (fresh checkout
// without a local env file, or a build missing VITE_BACKEND_URL).
if (!backendUrl) {
    throw new Error(
        'VITE_BACKEND_URL is not set. For local development run `cp .env.example .env` ' +
            'and fill in the backend URL (see docs/BACKEND_SETUP.md). ' +
            'Production builds read it from .env.production.',
    );
}

export const directusConfig = {
    url: backendUrl,
};
