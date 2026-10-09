import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';

import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import {
    filtersFromQuery,
    filtersToQuery,
    useSongFilterHistory,
} from '@/composables/useSongFilterHistory';
import { type FilterState } from '@/composables/useSongFiltering';

function emptyFilters(): FilterState {
    return {
        searchQuery: '',
        searchScope: 'text',
        selectedCategories: [],
        indexRange: null,
        selectedAuthors: [],
        selectedMelodien: [],
    };
}

// Das Gerüst der App, so weit es hier zählt: die Liste und ein Lied daneben.
async function setup(start = '/tabs/lieder') {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/tabs/lieder', name: 'Songs', component: { render: () => null } },
            { path: '/songs/:id', name: 'Song', component: { render: () => null } },
        ],
    });
    await router.push(start);
    await router.isReady();

    const filters = ref(emptyFilters());
    mount(
        defineComponent({
            setup() {
                useSongFilterHistory(filters);
                return () => h('div');
            },
        }),
        { global: { plugins: [router] } },
    );
    await settle();

    return { router, filters };
}

async function settle() {
    await nextTick();
    await flushPromises();
}

// Zurück, und warten, bis der Router angekommen ist.
async function back(router: ReturnType<typeof createRouter>) {
    const landed = new Promise<void>((resolve) => {
        const stop = router.afterEach(() => {
            stop();
            resolve();
        });
    });
    router.back();
    await landed;
    await settle();
}

describe('Filter in der Adresse', () => {
    it('hin und zurück ohne Verlust', () => {
        const f = {
            selectedCategories: ['Advent', 'Weihnachten'],
            selectedAuthors: ['Martin Luther'],
            selectedMelodien: ['3'],
            indexRange: { min: 10, max: 80 },
        };
        expect(filtersToQuery(f)).toEqual({
            kategorie: ['Advent', 'Weihnachten'],
            autor: ['Martin Luther'],
            weise: ['3'],
            nr: '10-80',
        });
        expect(filtersFromQuery({ ...filtersToQuery(f), nr: '10-80' } as never)).toEqual(f);
    });
});

describe('Filter in der Browser-Historie', () => {
    it('nimmt mit Zurück den Filter wieder ab', async () => {
        const { router, filters } = await setup();

        filters.value.selectedCategories.push('Advent');
        await settle();
        expect(router.currentRoute.value.fullPath).toBe('/tabs/lieder?kategorie=Advent');

        await back(router);
        expect(router.currentRoute.value.fullPath).toBe('/tabs/lieder');
        expect(filters.value.selectedCategories).toEqual([]);
    });

    it('braucht für zwei Filter nur ein Zurück', async () => {
        const { router, filters } = await setup();

        filters.value.selectedCategories.push('Advent');
        await settle();
        filters.value.indexRange = { min: 1, max: 50 };
        await settle();
        expect(router.currentRoute.value.fullPath).toBe('/tabs/lieder?kategorie=Advent&nr=1-50');

        await back(router);
        expect(router.currentRoute.value.fullPath).toBe('/tabs/lieder');
        expect(filters.value.selectedCategories).toEqual([]);
        expect(filters.value.indexRange).toBeNull();
    });

    it('hinterlässt keinen toten Eintrag, wenn der letzte Filter von Hand abgeht', async () => {
        const { router, filters } = await setup();
        await router.push('/songs/1');
        await router.push('/tabs/lieder');
        await settle();

        filters.value.selectedAuthors.push('Martin Luther');
        await settle();
        filters.value.selectedAuthors.splice(0, 1);
        await settle();
        expect(router.currentRoute.value.fullPath).toBe('/tabs/lieder');

        // Der Filter-Eintrag ist wieder weg: ein Zurück führt zum Lied, nicht
        // zur selben ungefilterten Liste noch einmal.
        await back(router);
        expect(router.currentRoute.value.name).toBe('Song');
    });

    it('stellt den Filter wieder her, wenn man vom Lied zurückkommt', async () => {
        const { router, filters } = await setup();

        filters.value.selectedMelodien.push('3');
        await settle();
        await router.push('/songs/1');
        await settle();

        await back(router);
        expect(router.currentRoute.value.fullPath).toBe('/tabs/lieder?weise=3');
        expect(filters.value.selectedMelodien).toEqual(['3']);
    });

    it('übernimmt einen Link aus der Lied-Ansicht als frischen Wunsch', async () => {
        const { router, filters } = await setup();
        filters.value.searchQuery = 'gnade';
        filters.value.selectedCategories.push('Advent');
        await settle();

        await router.push('/songs/1');
        await router.push({ path: '/tabs/lieder', query: { autor: 'Martin Luther' } });
        await settle();

        expect(filters.value.selectedAuthors).toEqual(['Martin Luther']);
        expect(filters.value.selectedCategories).toEqual([]);
        expect(filters.value.searchQuery).toBe('');
    });
});
