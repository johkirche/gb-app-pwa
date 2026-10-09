import { type Ref, ref, watch } from 'vue';

import type { LocationQuery, LocationQueryRaw, Router } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import type { FilterState } from '@/composables/useSongFiltering';

/** The list's route name — the only place the filters are read from the URL. */
const SONGS_ROUTE = 'Songs';

/** The query keys the filters live under. `autor` and `weise` are also what the song view links to. */
const FILTER_KEYS = ['kategorie', 'autor', 'weise', 'nr'] as const;

/** Marks the history entry the first filter pushed, so taking the last one off can pop it again. */
const FILTER_ENTRY = 'gbFilterEntry';

type FilterFields = Pick<
    FilterState,
    'selectedCategories' | 'selectedAuthors' | 'selectedMelodien' | 'indexRange'
>;

/**
 * Where the Lieder tab leads: the list as the reader last left it, filters and
 * all. The tab bar links here rather than to the bare path, because the filters
 * now live in the URL — a link to `/tabs/lieder` would be a link to an
 * unfiltered list, and a trip to Playlisten and back would cost the reader their
 * filter, which the kept-alive page never used to.
 */
export const songsListPath = ref('/tabs/lieder');

function list(value: LocationQuery[string] | undefined): string[] {
    const values = Array.isArray(value) ? value : [value];
    return values.filter((v): v is string => !!v);
}

export function filtersFromQuery(query: LocationQuery): FilterFields {
    const nr = list(query.nr)[0]?.match(/^(\d+)-(\d+)$/);
    return {
        selectedCategories: list(query.kategorie),
        selectedAuthors: list(query.autor),
        selectedMelodien: list(query.weise),
        indexRange: nr ? { min: Number(nr[1]), max: Number(nr[2]) } : null,
    };
}

export function filtersToQuery(f: FilterFields): LocationQueryRaw {
    const query: LocationQueryRaw = {};
    if (f.selectedCategories.length) query.kategorie = [...f.selectedCategories];
    if (f.selectedAuthors.length) query.autor = [...f.selectedAuthors];
    if (f.selectedMelodien.length) query.weise = [...f.selectedMelodien];
    if (f.indexRange) query.nr = `${f.indexRange.min}-${f.indexRange.max}`;
    return query;
}

function key(f: FilterFields): string {
    return JSON.stringify(filtersToQuery(f));
}

function isFiltered(f: FilterFields): boolean {
    return Object.keys(filtersToQuery(f)).length > 0;
}

function waitForNavigation(router: Router): Promise<void> {
    return new Promise((resolve) => {
        const timeout = setTimeout(done, 1000);
        const stop = router.afterEach(done);
        function done() {
            clearTimeout(timeout);
            stop();
            resolve();
        }
    });
}

/**
 * Puts the list's filters on the browser history, so Back takes them off.
 *
 * One entry for the filtered list, not one per filter: the first filter pushes
 * an entry, every change after it replaces that entry, and taking the last one
 * off pops it again. A reader who picked three categories and a range wants
 * Back to return them to the book, not to walk them through their own clicks.
 *
 * The search stays out of it. It changes with every keystroke, and Back
 * un-typing a word letter by letter is not what anyone means by it.
 */
export function useSongFilterHistory(filters: Ref<FilterState>) {
    const route = useRoute();
    const router = useRouter();

    // Our own navigation in flight. The route watcher keeps its hands off
    // meanwhile — it would otherwise write the URL we are leaving back into
    // the filters a quick second tap has already moved on from.
    let syncing = false;
    let dirty = false;
    // Off the list since the last time we looked: a filter arriving from there
    // is a fresh intent (a tap on an author in the song view), not a step back.
    let arrivedFromElsewhere = true;

    watch(
        () => route.fullPath,
        () => {
            if (route.name !== SONGS_ROUTE) {
                arrivedFromElsewhere = true;
                return;
            }
            songsListPath.value = route.fullPath;
            const fresh = arrivedFromElsewhere;
            arrivedFromElsewhere = false;
            if (syncing) return;

            const incoming = filtersFromQuery(route.query);
            if (key(incoming) === key(filters.value)) return;

            // "Show me Luther's songs" means exactly those, not the ones that
            // also happen to match whatever was still typed in the search.
            if (fresh && isFiltered(incoming)) filters.value.searchQuery = '';
            Object.assign(filters.value, incoming);
        },
        { immediate: true },
    );

    watch(() => key(filters.value), sync);

    async function sync() {
        if (syncing) {
            dirty = true;
            return;
        }
        syncing = true;
        try {
            do {
                dirty = false;
                await step();
            } while (dirty);
        } finally {
            syncing = false;
        }
    }

    async function step() {
        if (route.name !== SONGS_ROUTE) return;

        const current = filtersFromQuery(route.query);
        if (key(current) === key(filters.value)) return;

        const rest = Object.fromEntries(
            Object.entries(route.query).filter(
                ([k]) => !(FILTER_KEYS as readonly string[]).includes(k),
            ),
        );
        const target = { path: route.path, query: { ...rest, ...filtersToQuery(filters.value) } };
        const onFilterEntry = !!router.options.history.state?.[FILTER_ENTRY];

        if (!isFiltered(current)) {
            await router.push({ ...target, state: { [FILTER_ENTRY]: true } });
        } else if (!isFiltered(filters.value) && onFilterEntry) {
            // The entry below is the unfiltered list this one was pushed from.
            const landed = waitForNavigation(router);
            router.back();
            await landed;
        } else {
            await router.replace({
                ...target,
                state: onFilterEntry ? { [FILTER_ENTRY]: true } : {},
            });
        }
    }
}
