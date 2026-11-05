/**
 * The short tour the onboarding shows once the book is down: what a reader
 * will look for first, and where it is. Each slide is a step of the onboarding
 * of its own, and names the control as the app labels it, so what is read here
 * is what is then found on the screen.
 *
 * `bibel` is the one that asks something: the Bible is off until someone wants
 * it, and this is where they are most likely to.
 *
 * `gedrueckt` is the one that depends on the device. The long press is touch
 * only (see directives/longPress), so a mouse has to be told about the right
 * click, and a finger has no use for hearing about a mouse.
 */

export type TourKind = 'suchen' | 'gedrueckt' | 'groesse' | 'hoeren' | 'ablauf' | 'bibel';

export interface TourSlide {
    kind: TourKind;
    title: string;
    text: string;
}

const ROW_MENU = 'Im Menü fügen Sie es zu den Favoriten, zu einer Playlist oder zum Ablauf hinzu.';

/**
 * A finger or a mouse, read off the pointer as preferShareSheet and
 * mayUseMobileData do. The dev phone preview counts as a finger, because a held
 * mouse button long-presses in there and the frame is meant to rehearse a phone.
 */
function usesFinger(win: Window): boolean {
    return (
        (win.matchMedia?.('(pointer: coarse)').matches ?? false) ||
        win.document.documentElement.classList.contains('viewport-preview')
    );
}

export function tourSlides(win: Window = window): readonly TourSlide[] {
    return [
        {
            kind: 'suchen',
            title: 'Lieder finden',
            text: 'Mit der Lupe oben rechts suchen Sie nach Nummer, Titel oder einer Zeile aus dem Text.',
        },
        usesFinger(win)
            ? {
                  kind: 'gedrueckt',
                  title: 'Gedrückt halten',
                  text: `Halten Sie ein Lied in der Liste mit dem Finger gedrückt. ${ROW_MENU}`,
              }
            : {
                  kind: 'gedrueckt',
                  title: 'Rechtsklick',
                  text: `Klicken Sie ein Lied in der Liste mit der rechten Maustaste an. ${ROW_MENU} Auf dem Handy halten Sie es dafür gedrückt.`,
              },
        {
            kind: 'groesse',
            title: 'Größer lesen',
            text: 'Die Größe stellen Sie in den Einstellungen ein oder im Lied über das Zahnrad. Sie gilt für die ganze App.',
        },
        {
            kind: 'hoeren',
            title: 'Melodie anhören',
            text: 'Die App spielt Ihnen jedes Lied vor und färbt dabei die Note, die gerade klingt. Die Taste dafür finden Sie unten im Lied.',
        },
        {
            kind: 'ablauf',
            title: 'Für den Gottesdienst',
            text: 'Mit „Zum Ablauf hinzufügen“ stellen Sie die Lieder zusammen. Auch Bibelstellen können als Lesung dazu. Alles steht dann unter „Ablauf“ und lässt sich als Playlist sichern.',
        },
        {
            kind: 'bibel',
            title: 'Bibel lesen',
            text: 'Auf Wunsch bekommt die Bibel einen eigenen Reiter. Das können Sie später in den Einstellungen ändern.',
        },
    ];
}
