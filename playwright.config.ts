import { defineConfig, devices } from '@playwright/test';

/*
 * The e2e suite exists to watch the shell under the reader's Größe, so it runs
 * against the dev server the app actually develops on (`pnpm dev`, port 8100 —
 * vite.config.ts pins it with strictPort). Playwright starts it itself and
 * reuses one that is already up, so `pnpm test:e2e` is the whole command.
 */
const PORT = 8100;
const baseURL = `http://localhost:${PORT}`;

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
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
