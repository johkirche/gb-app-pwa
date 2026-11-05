import { type Locator, type Page, expect, test } from '@playwright/test';

/*
 * A toast can be swiped off the screen, in the directions a thumb actually goes.
 *
 * It sits over whatever the reader came for, and until it times out there is
 * nothing to press. The toasts come from the <Toaster /> in App.vue, so any page
 * would do; /dev/ui is the one with a button that raises one, and it needs no
 * recording and no session.
 */

test.use({
    viewport: { width: 390, height: 844 },
    // The worker's „offline verfügbar" toast would land on top of the one under test.
    serviceWorkers: 'block',
});

// /dev/ui is the kitchen sink, served unbundled: with every worker on it at once,
// Firefox spends most of the default 30s just getting the page up.
test.describe.configure({ timeout: 60_000 });

const MESSAGE = 'Änderungen wurden gespeichert.';

/** Past sonner's 45px threshold, so the distance decides and not the speed. */
const SIDEWAYS = 120;

/** Less room this way: a toast with no tab bar under it sits near the bottom edge. */
const DOWNWARDS = 50;

async function raiseToast(page: Page): Promise<Locator> {
    await page.goto('/dev/ui');
    await page.getByRole('button', { name: 'Toast anzeigen' }).click();

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: MESSAGE });
    // Waits out the entrance, so nothing below measures a toast still on its way
    // in. A pointer resting on a toast also stops its clock, which takes the four
    // seconds it lasts on its own out of a slow engine's way.
    await toast.hover();
    return toast;
}

/** On the toast's text: where a thumb lands, and where a mouse would start selecting. */
async function grip(toast: Locator) {
    const box = await toast.locator('[data-title]').boundingBox();
    if (!box) throw new Error('the toast has no text to take hold of');
    return { x: box.x + box.width / 2, y: box.y + 2 };
}

async function position(toast: Locator) {
    // Bounded, because the default waits out the whole test for a toast that left.
    const box = await toast.boundingBox({ timeout: 5000 });
    if (!box) throw new Error('the toast has no box');
    return box;
}

for (const [direction, dx, dy] of [
    ['left', -SIDEWAYS, 0],
    ['right', SIDEWAYS, 0],
    ['down', 0, DOWNWARDS],
] as const) {
    test(`a mouse drags a toast away: ${direction}`, async ({ page }) => {
        const toast = await raiseToast(page);
        const from = await grip(toast);
        const start = await position(toast);

        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        // The first pixels one at a time, as a hand does it: that is where a mouse
        // starts selecting, and sonner gives up on a swipe once any text is selected.
        await page.mouse.move(from.x + 8 * Math.sign(dx), from.y + 8 * Math.sign(dy), { steps: 8 });
        await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });

        // It follows the pointer, rather than sitting still until let go.
        await expect.poll(async () => (await position(toast)).x - start.x).toBeCloseTo(dx, -1);
        await expect.poll(async () => (await position(toast)).y - start.y).toBeCloseTo(dy, -1);

        await page.mouse.up();
        await expect(toast).toHaveCount(0, { timeout: 2000 });
    });
}

test('a drag let go early puts the toast back', async ({ page }) => {
    const toast = await raiseToast(page);
    const from = await grip(toast);
    const start = await position(toast);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 20, from.y, { steps: 20 });
    // Slowly enough that sonner's flick test is not what decides this.
    await page.waitForTimeout(400);
    await page.mouse.up();

    await expect(toast).toBeVisible();
    await expect.poll(async () => (await position(toast)).x).toBeCloseTo(start.x, 0);
});

test.describe('on a touchscreen', () => {
    test.use({ hasTouch: true });

    /*
     * The case the feature is for, and a different path from the mouse: the
     * browser may claim a touch as a scroll and cancel the pointer. Playwright
     * only offers a tap, so the swipe goes in through CDP — Chromium alone, and
     * iOS has to be taken on trust from `touch-action: none` on the toast.
     */
    test('a thumb swipes a toast away sideways', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'touch input needs CDP');

        const toast = await raiseToast(page);
        const from = await grip(toast);
        const start = await position(toast);

        const cdp = await page.context().newCDPSession(page);
        const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number) =>
            cdp.send('Input.dispatchTouchEvent', {
                type,
                touchPoints: x === undefined ? [] : [{ x, y: from.y }],
            });

        await touch('touchStart', from.x);
        for (let step = 1; step <= 12; step++) {
            await touch('touchMove', from.x + (SIDEWAYS * step) / 12);
        }

        // Polled: Chromium hands touch moves over a frame at a time.
        await expect
            .poll(async () => (await position(toast)).x - start.x)
            .toBeCloseTo(SIDEWAYS, -1);

        await touch('touchEnd');
        await expect(toast).toHaveCount(0, { timeout: 2000 });
    });
});
