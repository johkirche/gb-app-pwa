import { createReadStream, existsSync, statSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

/*
 * A static server over a built dist/, for the two specs that need the real
 * service worker.
 *
 * `vite preview` would serve the same files, but not on the terms these specs
 * need. It is a subprocess to spawn, wait for and kill; it wants a port fixed
 * in advance, which three engines running in parallel then have to divide up by
 * hand; and update.spec.ts has to *edit* what is being served between two loads
 * to stand in for a deploy, which means knowing that every request is answered
 * off the disk as it is now.
 *
 * Twenty lines of node:http give all three. The port is whatever the OS hands
 * out, so parallel projects cannot collide.
 */

const TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.otf': 'font/otf',
    '.xml': 'application/xml',
};

export interface Preview {
    url: string;
    close: () => Promise<void>;
}

export async function servePreview(root: string): Promise<Preview> {
    const base = resolve(root);

    const server: Server = createServer((req, res) => {
        // Strip the query: workbox asks for `index.html?__WB_REVISION__=…`, and
        // a precache entry that 404s takes the whole install down with it.
        const path = decodeURIComponent((req.url ?? '/').split('?')[0]);

        // normalize() collapses any ../ before it can leave the directory.
        let file = join(base, normalize(path));
        if (!file.startsWith(base + sep) && file !== base) file = base;
        if (!existsSync(file) || statSync(file).isDirectory()) {
            // History routing: every unknown address is the app's own.
            file = join(base, 'index.html');
        }

        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        // Nothing here may be answered out of the HTTP cache: a test that has
        // just rewritten sw.js on disk has to be served the file it wrote.
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(file).pipe(res);
    });

    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('preview has no port');

    return {
        url: `http://localhost:${address.port}`,
        close: () =>
            new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done()))),
    };
}
