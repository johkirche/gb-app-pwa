import { type Page, expect, test } from '@playwright/test';

/*
 * Größe is the whole app's size, and a page that grows until it runs off the
 * side of the phone has not honoured it — it has broken under it. The unit
 * guard in src/theme/readability.spec.ts can see that the type is stated in rem;
 * only a browser can see what the type then does to the layout.
 *
 * So: walk the shell at both ends of the band and assert that nothing sticks
 * out sideways. It caught the Einstellungen overview, where a grid item would
 * not shrink under the min-content width of its own `truncate` summaries and
 * the pane's overflow-hidden cut them off mid-word.
 *
 * Run it with `pnpm test:e2e` — playwright.config.ts starts the dev server.
 */

/** Phone first: the narrowest thing the app has to survive being enlarged on. */
const VIEWPORT = { width: 390, height: 844 };

/** The ends of --app-scale, plus the resting size in between. */
const SCALES = ['0.5', '1', '2'];

test.use({
    viewport: VIEWPORT,
    // The settings panes slide in from translateX(100%), so mid-transition a
    // pane is legitimately off the right edge. Reduced motion drops the slide
    // to a fade (SettingsPage.vue honours it), which leaves nothing to race:
    // what this spec measures is settled layout, not animation.
    reducedMotion: 'reduce',
});

/** The tab bar that is on screen — the app renders a second, hidden one for ≥ lg. */
function nav(page: Page) {
    return page.locator('nav[aria-label="Hauptnavigation"]:visible');
}

/** Let the layout stop moving before measuring it. */
async function settle(page: Page) {
    await page.waitForTimeout(200);
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
            ),
    );
}

async function setScale(page: Page, scale: string) {
    await page.evaluate((value) => {
        document.documentElement.style.setProperty('--page-scale', value);
    }, scale);
    await settle(page);
}

/** Everything whose box leaves the viewport to the left or the right. */
async function overflowingAt(page: Page, where: string, scale: string) {
    return page.evaluate(
        ({ where, scale }) => {
            const root = document.documentElement;
            const out: string[] = [];

            const sideways = root.scrollWidth - root.clientWidth;
            if (sideways > 1) {
                out.push(`${where} @${scale}: the page scrolls sideways by ${sideways}px`);
            }

            const limit = root.clientWidth + 1;
            for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;
                if (rect.right > limit || rect.left < -1) {
                    const cls = (el.className || '').toString().slice(0, 60);
                    out.push(`${where} @${scale}: <${el.tagName.toLowerCase()} class="${cls}">`);
                }
            }
            return [...new Set(out)];
        },
        { where, scale },
    );
}

async function expectNoOverflow(page: Page, where: string) {
    for (const scale of SCALES) {
        await setScale(page, scale);
        expect(await overflowingAt(page, where, scale), `${where} at ${scale}`).toEqual([]);
    }
    await setScale(page, '1');
}

test.describe('the app at every size it offers', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // The app has no content until it is synced; the dev skip is what gets
        // the shell on screen, which is what this spec is about.
        await page.getByRole('button', { name: /^Überspringen/ }).click({ timeout: 20_000 });
        await expect(nav(page)).toBeVisible({ timeout: 20_000 });
        // A fallback face is a different set of widths than the real one.
        await page.evaluate(() => document.fonts.ready);
    });

    test('keeps the tabs inside the phone', async ({ page }) => {
        await expectNoOverflow(page, 'Lieder');

        for (const tab of ['Playlisten', 'Einstellungen']) {
            const link = nav(page).getByRole('link', { name: tab });
            await link.click();
            await expect(link).toHaveAttribute('aria-current', 'page');
            await expectNoOverflow(page, tab);
        }
    });

    // The search row and the options popover hanging off it — „Titel + Text"
    // is the longest label in the shell that looks unbreakable. Both are only
    // on screen while searching, so the tab walk above never reaches them.
    test('keeps the open search and its options inside the phone', async ({ page }) => {
        await page.getByRole('button', { name: 'Suchen' }).click();
        await expect(page.getByPlaceholder('Suchen...')).toBeVisible();
        await settle(page);
        await expectNoOverflow(page, 'Lieder/Suche');

        await page.getByRole('button', { name: 'Suchoptionen' }).click();
        await expect(page.getByRole('group', { name: 'Suchbereich' })).toBeVisible();
        await settle(page);
        await expectNoOverflow(page, 'Lieder/Suchoptionen');
    });

    test('keeps every Einstellungen section inside the phone', async ({ page }) => {
        await nav(page).getByRole('link', { name: 'Einstellungen' }).click();

        // The overview's rows are the only buttons in the pane; the one in the
        // header is the way back out of a section.
        const rows = page.locator('main section button');
        const back = page.getByRole('button', { name: 'Zurück zur Übersicht' });

        // Read the sections off the page rather than listing them here, so one
        // added later is walked without anyone remembering to add it.
        const titles = await rows.evaluateAll((buttons) =>
            buttons.map((button) => button.querySelector('p')?.textContent?.trim() ?? ''),
        );
        expect(titles.length, 'the Einstellungen overview lists no sections').toBeGreaterThan(0);

        for (const [index, title] of titles.entries()) {
            // Both panes are in the DOM while one is leaving; wait for the
            // overview to be alone again before counting rows off it.
            await expect(rows).toHaveCount(titles.length);
            await rows.nth(index).click();
            await expect(back).toBeVisible();
            await settle(page);

            await expectNoOverflow(page, `Einstellungen/${title}`);

            await back.click();
            await expect(back).toBeHidden();
            await settle(page);
        }
    });
});
