/**
 * The short tour the onboarding shows while the book comes down: what a reader
 * will look for first, and where it is. Each slide names the control as the
 * app labels it, so what is read here is what is then found on the screen.
 */

export type TourKind = 'suchen' | 'groesse' | 'hoeren' | 'ablauf';

export interface TourSlide {
    kind: TourKind;
    title: string;
    text: string;
}

export const TOUR: readonly TourSlide[] = [
    {
        kind: 'suchen',
        title: 'Lieder finden',
        text: 'Tippen Sie eine Nummer oder einen Titel ein. Mit „Titel + Text" sucht die App auch in den Strophen, und die Filter grenzen nach Kategorie, Autor oder Weise ein.',
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
        text: 'Mit „Zum Ablauf hinzufügen" im Liedmenü stellen Sie die Lieder für einen Gottesdienst zusammen; sie stehen dann im Tab „Ablauf". Was Sie öfter brauchen, speichern Sie als Playlist.',
    },
];
