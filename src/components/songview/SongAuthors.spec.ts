import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import SongAuthors from '@/components/songview/SongAuthors.vue';

import type { Song } from '@/db';

// Ein Lied mit allem, was die Fußzeile braucht — die Weise ist das, was hier
// geprüft wird, der Rest hält die Zeile am Leben.
function song(partial: Partial<Song> = {}): Song {
    return {
        id: '1',
        index: 266,
        titel: 'Ich bin ein Kind auf Erden',
        strophen: [],
        textAutoren: [{ vorname: 'Joseph', nachname: 'Weber' }],
        melodieAutoren: [{ vorname: 'Angela', nachname: 'Schäfer' }],
        noten: [],
        notentextMxml: null,
        kategorien: [],
        melodieId: '3',
        melodieTitel: 'Ich bin ein Kind auf Erden',
        choralbuchNummer: 162,
        ...partial,
    };
}

// RouterLink kommt aus dem Router, den es im Test nicht gibt — als Anker
// gestubbt bleibt das `to` als Attribut sichtbar und damit prüfbar.
const global = {
    stubs: {
        RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
        },
    },
};

describe('SongAuthors – Choralbuchnummer', () => {
    it('hängt die Nummer an die Melodie-Zeile, nicht an die Text-Zeile', () => {
        const wrapper = mount(SongAuthors, { props: { song: song() }, global });

        const zeilen = wrapper.findAll('.flex.items-start');
        expect(zeilen[0].text()).toContain('Text: Joseph Weber');
        expect(zeilen[0].text()).not.toContain('Choralbuch');
        expect(zeilen[1].text()).toContain('Melodie: Angela Schäfer');
        expect(zeilen[1].text()).toContain('Choralbuch 162');
    });

    it('verlinkt auf die Liederliste, gefiltert auf diese Weise', () => {
        const wrapper = mount(SongAuthors, { props: { song: song() }, global });

        const link = wrapper.findAll('a').find((a) => a.text().includes('Choralbuch'));
        expect(JSON.parse(link!.attributes('data-to')!)).toEqual({
            path: '/tabs/lieder',
            query: { weise: '3' },
        });
    });

    it('steht auch an der gemeinsamen „Text und Melodie"-Zeile', () => {
        const autor = { vorname: 'Paul', nachname: 'Gerhardt' };
        const wrapper = mount(SongAuthors, {
            props: { song: song({ textAutoren: [autor], melodieAutoren: [autor] }) },
            global,
        });

        const zeilen = wrapper.findAll('.flex.items-start');
        expect(zeilen).toHaveLength(1);
        expect(zeilen[0].text()).toContain('Text und Melodie: Paul Gerhardt');
        expect(zeilen[0].text()).toContain('Choralbuch 162');
    });

    it('bleibt weg, solange das Lied noch keine Nummer mitgebracht hat', () => {
        // So sehen Lieder aus, die vor dem Sync dieses Feldes gespeichert wurden.
        const wrapper = mount(SongAuthors, {
            props: { song: song({ melodieId: undefined, choralbuchNummer: undefined }) },
            global,
        });

        expect(wrapper.text()).not.toContain('Choralbuch');
    });

    it('bekommt eine eigene Zeile, wenn es zur Melodie sonst nichts zu sagen gibt', () => {
        const wrapper = mount(SongAuthors, {
            props: { song: song({ melodieAutoren: [], melodieCopyright: null }) },
            global,
        });

        const zeilen = wrapper.findAll('.flex.items-start');
        expect(zeilen.map((z) => z.text().trim())).toEqual([
            'Text: Joseph Weber',
            'Choralbuch 162',
        ]);
    });
});
