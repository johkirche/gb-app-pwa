import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

/*
 * The e2e suite exists to watch the shell under the reader's Größe, so it runs
 * against the dev server the app actually develops on (`pnpm dev`, port 8100 —
 * vite.config.ts pins it with strictPort). Playwright starts it itself and
 * reuses one that is already up, so `pnpm test:e2e` is the whole command.
 */
const PORT = 8100;
const baseURL = `http://localhost:${PORT}`;

/*
 * The suite reads .env the same way the app does, through Vite, so there is one
 * place the backend URL is written down. The empty prefix loads the unprefixed
 * names too: the recording run needs a real Directus account, and those must
 * *not* be VITE_ — anything with that prefix is inlined verbatim into the built
 * JS and shipped to every visitor (see .env.example).
 */
Object.assign(process.env, loadEnv('development', process.cwd(), ''));

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    // A stray .only would quietly shrink the suite to one case in CI.
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL,
        // Failures here are layout failures: the trace carries the DOM and the
        // screenshots that say which box left the phone.
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    /*
     * All three engines, in one run. Between them they are every browser the
     * hymnal is opened in: Chrome, Edge, Brave, Opera and the Android WebView
     * are Chromium; Safari *and every browser on iOS* — Chrome on an iPhone
     * included — are WebKit, which on a pew full of phones is the one that
     * would otherwise go unwatched. All three ship with Playwright, so this
     * needs nothing installed on the machine and behaves the same in CI.
     *
     * Branded Chrome or Edge would be `channel: 'chrome' | 'msedge'` on a
     * fourth project. They are Chromium too, so they add codecs and a user
     * agent rather than layout — and they fail wherever that browser is not
     * installed, which is why they are not here.
     *
     * The devices give each engine its own user agent; the 390px phone the
     * spec actually measures at is its own `test.use`. Full mobile emulation
     * is deliberately not used: `isMobile` is Chromium- and WebKit-only, and
     * an overflow guard that ran differently per engine would be worth less
     * than one narrow viewport that runs identically on all three.
     */
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
    webServer: {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
