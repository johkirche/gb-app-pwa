import type { Component } from 'vue';

import { Bookmark, CalendarCheck, Highlighter, Music2, Sparkles, Volume2 } from 'lucide-vue-next';

import type { BibelFeatures } from '@/db';

/** The Bible's features as the settings name them, in the order they are listed. */
export const BIBEL_FEATURE_LIST: {
    key: keyof BibelFeatures;
    label: string;
    description: string;
    icon: Component;
}[] = [
    {
        key: 'fortschritt',
        label: 'Lesefortschritt & Lesepläne',
        description: 'Kapitel als gelesen markieren, Fortschritt je Buch, „Heute lesen“',
        icon: CalendarCheck,
    },
    {
        key: 'lesezeichen',
        label: 'Lesezeichen',
        description: 'Mit einem Tipp auf die Versnummer setzen',
        icon: Bookmark,
    },
    {
        key: 'notizen',
        label: 'Markierungen & Notizen',
        description: 'Verse farbig markieren und eigene Notizen dazu schreiben',
        icon: Highlighter,
    },
    {
        key: 'versDerWoche',
        label: 'Vers der Woche',
        description: 'Ein Vers jede Woche, oben im Bibel-Reiter',
        icon: Sparkles,
    },
    {
        key: 'lieder',
        label: 'Lieder zum Kapitel',
        description: 'Die Lieder aus dem Gesangbuch, die sich auf das Kapitel beziehen',
        icon: Music2,
    },
    {
        key: 'vorlesen',
        label: 'Vorlesen',
        description: 'Ein Kapitel mit der Stimme des Geräts vorlesen lassen',
        icon: Volume2,
    },
];

/** "5 von 6 an", for the row that leads to the features and the overview. */
export function bibelFeatureSummary(features: BibelFeatures): string {
    const all = Object.values(features);
    return `${all.filter(Boolean).length} von ${all.length} an`;
}
