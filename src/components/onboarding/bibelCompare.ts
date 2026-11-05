/**
 * Two short passages as both translations set them, for a reader choosing between
 * them on the Bible's slide of the tour.
 *
 * In the bundle rather than read from public/bibeltext: that takes a whole book of
 * each, some 900 KB for these two, possibly over mobile data, and fails offline.
 * bibelCompare.spec.ts holds them to the shipped text, word for word.
 */

export interface BibelSample {
    slug: string;
    chapter: number;
    verses: number[];
    luther: string;
    menge: string;
    /** Menge's heading over the passage, where it has one right there. */
    mengeHeading?: string;
    /** Menge's note on a word, as the reader opens it behind its marker. */
    mengeNote?: { word: string; text: string };
}

export const BIBEL_SAMPLES: readonly BibelSample[] = [
    {
        slug: 'psalm',
        chapter: 23,
        verses: [1, 2, 3],
        luther: 'Ein Psalm Davids. Der HErr ist mein Hirte; mir wird nichts mangeln. Er weidet mich auf einer grünen Aue und führet mich zum frischen Wasser. Er erquicket meine Seele; er führet mich auf rechter Straße um seines Namens willen.',
        menge: 'Ein Psalm von David. Der HERR ist mein Hirt: mir mangelt nichts. Auf grünen Auen läßt er mich lagern, zum Lagerplatz am Bache führt er mich. Er erquickt meine Seele; er leitet mich auf rechten Pfaden um seines Namens willen.',
        mengeHeading:
            'Der Herr als der gute Hirt und der freundliche Spender von Trost und Sicherheit',
    },
    {
        slug: 'johannes',
        chapter: 3,
        verses: [16],
        luther: 'Also hat Gott die Welt geliebt, dass er seinen eingeborenen Sohn gab, auf dass alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben.',
        menge: 'Denn so sehr hat Gott die Welt geliebt, daß er seinen eingeborenen Sohn hingegeben hat, damit alle, die an ihn glauben, nicht verloren gehen, sondern ewiges Leben haben.',
        mengeNote: { word: 'eingeborenen', text: '= einzigen' },
    },
];
