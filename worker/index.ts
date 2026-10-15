import { type DemoEnv, handleDemoRequest } from './demo';

/**
 * The Worker in front of the static app.
 *
 * It only ever sees /api/* — `run_worker_first` in wrangler.jsonc routes
 * everything else straight to the assets, SPA fallback included, exactly as
 * before there was a Worker at all.
 */

export default {
    async fetch(request: Request, env: DemoEnv): Promise<Response> {
        const { pathname } = new URL(request.url);

        if (pathname.startsWith('/api/demo/')) {
            return handleDemoRequest(request, env);
        }

        return new Response('Not found', { status: 404 });
    },
};
