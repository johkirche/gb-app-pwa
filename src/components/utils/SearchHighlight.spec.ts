import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import SearchHighlight from './SearchHighlight.vue';

function render(text: string, terms: string[]) {
    return mount(SearchHighlight, { props: { text, terms } });
}

describe('SearchHighlight', () => {
    // Der Titel wird in Stücke zerlegt und aus Elementen wieder aufgebaut; der
    // Template-Compiler dürfte dabei weder einen Zwischenraum verschlucken noch
    // einen erfinden — „Herren" darf nicht als „Herr en" dastehen.
    it('setzt den Text unverändert wieder zusammen', () => {
        expect(render('Lobet den Herren', ['herr']).text()).toBe('Lobet den Herren');
        expect(render('Lobet den Herren', []).text()).toBe('Lobet den Herren');
        expect(render('Gott ist Gott', ['gott']).text()).toBe('Gott ist Gott');
    });

    it('markiert die getroffenen Stellen im ungefalteten Text', () => {
        const marks = render('Großer Gott, wir loben dich', ['grosser', 'loben']);
        expect(marks.findAll('mark').map((mark) => mark.text())).toEqual(['Großer', 'loben']);
    });

    it('lässt einen Text ohne Treffer unmarkiert', () => {
        expect(render('Lobet den Herren', ['bach']).findAll('mark')).toHaveLength(0);
    });
});
