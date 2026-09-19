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
 * Needs the dev server (`pnpm dev`, port 8100):
 *   pnpm cypress run --config baseUrl=http://localhost:8100
 */

/** Phone first: the narrowest thing the app has to survive being enlarged on. */
const VIEWPORT: [number, number] = [390, 844];

/** The ends of --app-scale, plus the resting size in between. */
const SCALES = ['0.5', '1', '2'];

function setScale(scale: string) {
    cy.document().then((doc) => {
        doc.documentElement.style.setProperty('--page-scale', scale);
    });
    // Let the reflow settle before measuring it.
    cy.wait(250);
}

/** Everything whose box leaves the viewport to the left or the right. */
function overflowingAt(where: string, scale: string) {
    return cy.document().then((doc) => {
        const root = doc.documentElement;
        const out: string[] = [];

        const page = root.scrollWidth - root.clientWidth;
        if (page > 1) out.push(`${where} @${scale}: the page scrolls sideways by ${page}px`);

        const limit = root.clientWidth + 1;
        for (const el of Array.from(doc.querySelectorAll<HTMLElement>('body *'))) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (rect.right > limit || rect.left < -1) {
                const cls = (el.className || '').toString().slice(0, 60);
                out.push(`${where} @${scale}: <${el.tagName.toLowerCase()} class="${cls}">`);
            }
        }
        return [...new Set(out)];
    });
}

function expectNoOverflow(where: string) {
    for (const scale of SCALES) {
        setScale(scale);
        overflowingAt(where, scale).then((found) => {
            expect(found, `${where} at ${scale}`).to.deep.equal([]);
        });
    }
    setScale('1');
}

describe('the app at every size it offers', () => {
    beforeEach(() => {
        cy.viewport(...VIEWPORT);
        cy.visit('/');
        // The app has no content until it is synced; the dev skip is what gets
        // the shell on screen, which is what this spec is about.
        cy.contains('Überspringen', { timeout: 20000 }).click();
        cy.get('nav[aria-label="Hauptnavigation"]:visible', { timeout: 20000 }).should(
            'be.visible',
        );
    });

    it('keeps the tabs inside the phone', () => {
        expectNoOverflow('Lieder');

        for (const tab of ['Playlisten', 'Einstellungen']) {
            cy.get('nav[aria-label="Hauptnavigation"]:visible').contains(tab).click();
            cy.wait(500);
            expectNoOverflow(tab);
        }
    });

    it('keeps every Einstellungen section inside the phone', () => {
        cy.get('nav[aria-label="Hauptnavigation"]:visible').contains('Einstellungen').click();
        cy.wait(500);

        // Gottesdienst only appears once songs are pinned for a service, so the
        // list is checked against what is actually on screen.
        for (const section of ['Konto', 'Darstellung', 'Wiedergabe', 'Daten', 'Über']) {
            cy.get('body').then(($body) => {
                if (!$body.text().includes(section)) return;
                cy.contains('button', section).first().click({ force: true });
                cy.wait(500);
                expectNoOverflow(`Einstellungen/${section}`);
                cy.get('[aria-label="Zurück zur Übersicht"]').click({ force: true });
                cy.wait(400);
            });
        }
    });
});
