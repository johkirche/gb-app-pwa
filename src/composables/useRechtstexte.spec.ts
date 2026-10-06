import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RechtstextValue from '@/components/legal/RechtstextValue.vue';

import { resetRechtstexte, useRechtstexte } from './useRechtstexte';

const meta = new Map<string, { key: string; value: string }>();

vi.mock('@/db', () => ({
    db: {
        meta: {
            get: async (key: string) => meta.get(key),
            put: async (row: { key: string; value: string }) => void meta.set(row.key, row),
        },
    },
}));

vi.mock('@/services/directus', () => ({ directusConfig: { url: 'https://backend.test' } }));

function respond(data: unknown) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 })),
    );
}

describe('useRechtstexte', () => {
    beforeEach(() => {
        meta.clear();
        resetRechtstexte();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('fetches the texts without a token, keeps them, and leaves out empty ones', async () => {
        respond({
            impressum_anbieter: '  Johannische Kirche e. V. ',
            impressum_telefon: '',
            extra: 1,
        });
        const { texte, state } = useRechtstexte();
        await flushPromises();

        expect(state.value).toBe('ready');
        expect(texte.value?.impressum_anbieter).toBe('Johannische Kirche e. V.');
        expect(texte.value?.impressum_telefon).toBeNull();
        const [url, init] = vi.mocked(fetch).mock.calls[0];
        expect(String(url)).toContain('https://backend.test/items/rechtstexte');
        expect(init).toBeUndefined();
        expect(meta.has('rechtstexte')).toBe(true);
    });

    it('offline, shows what was kept', async () => {
        meta.set('rechtstexte', {
            key: 'rechtstexte',
            value: JSON.stringify({ impressum_anbieter: 'Gespeichert' }),
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Promise.reject(new TypeError('offline'))),
        );
        const { texte, state } = useRechtstexte();
        await flushPromises();

        expect(state.value).toBe('ready');
        expect(texte.value?.impressum_anbieter).toBe('Gespeichert');
    });

    it('offline with nothing kept, says it will come once online', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Promise.reject(new TypeError('offline'))),
        );
        const { texte, state } = useRechtstexte();
        await flushPromises();

        expect(texte.value).toBeNull();
        expect(state.value).toBe('missing');
        const wrapper = mount(RechtstextValue, { props: { value: null, state: state.value } });
        expect(wrapper.text()).toContain('sobald das Gerät mit dem Internet verbunden ist');
    });
});

describe('RechtstextValue', () => {
    it('keeps the lines of an address, and sets paragraphs apart', () => {
        const wrapper = mount(RechtstextValue, {
            props: { value: 'Straße 1\n12345 Ort\n\nZweiter Absatz', state: 'ready' },
        });
        const paragraphs = wrapper.findAll('p');
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[0].text()).toContain('12345 Ort');
    });

    it('says an entry not yet written is still to come', () => {
        const wrapper = mount(RechtstextValue, { props: { value: null, state: 'ready' } });
        expect(wrapper.text()).toBe('Wird von der Organisation ergänzt.');
    });
});
