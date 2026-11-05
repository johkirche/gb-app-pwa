/**
 * The short tour the onboarding shows once the book is down: what a reader
 * will look for first, and where it is. Each slide is a step of the onboarding
 * of its own, and names the control as the app labels it, so what is read here
 * is what is then found on the screen.
 *
 * `bibel` is the one that asks something: the Bible is off until someone wants
 * it, and this is where they are most likely to.
 */

export type TourKind = 'suchen' | 'gedrueckt' | 'groesse' | 'hoeren' | 'ablauf' | 'bibel';

export interface TourSlide {
    kind: TourKind;
    title: string;
    text: string;
}

export const TOUR: readonly TourSlide[] = [
    {
        kind: 'suchen',
        title: 'Lieder finden',
        text: 'Tippen Sie oben rechts auf die Lupe und geben Sie eine Nummer oder einen Titel ein. Mit „Titel + Text" sucht die App auch in den Strophen.',
    },
    {
        kind: 'gedrueckt',
        title: 'Gedrückt halten',
        text: 'Halten Sie ein Lied in der Liste gedrückt, am Computer genügt ein Rechtsklick. Im Menü legen Sie es zu den Favoriten, in eine Playlist oder in den Ablauf.',
    },
    {
        kind: 'groesse',
        title: 'Größer lesen',
        text: 'Die Größe stellen Sie im Liedmenü oder in den Einstellungen ein. Sie gilt dann für die ganze App, auch für die Liederliste und die Einstellungen.',
    },
    {
        kind: 'hoeren',
        title: 'Melodie anhören',
        text: 'Hat ein Lied Noten, spielt die App die Melodie vor. Auf Wunsch färbt sie dabei die Note, die gerade klingt.',
    },
    {
        kind: 'ablauf',
        title: 'Für den Gottesdienst',
        text: 'Mit „Zum Ablauf hinzufügen" stellen Sie die Lieder für einen Gottesdienst zusammen. Sie stehen dann im Tab „Ablauf". Was Sie öfter brauchen, speichern Sie als Playlist.',
    },
    {
        kind: 'bibel',
        title: 'Bibel lesen',
        text: 'Auf Wunsch bekommt die Bibel einen eigenen Reiter. Sie können das später ändern.',
    },
];
