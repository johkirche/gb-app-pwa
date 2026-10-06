<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Bibel durchsuchen">
            <template #leading>
                <BackButton default-href="/tabs/bibel" />
            </template>
        </AppPageHeader>

        <!-- Query and scope stay put; the results scroll under them. -->
        <div class="shrink-0 border-b border-border bg-background">
            <div class="page-col flex flex-col gap-2 py-3 sm:flex-row">
                <div
                    class="flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-lg bg-muted px-3"
                    @click="inputRef?.focus()"
                >
                    <Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        ref="inputRef"
                        v-model="query"
                        type="search"
                        enterkeyhint="search"
                        autocomplete="off"
                        class="min-w-0 flex-1 bg-transparent py-2 text-[1rem] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                        placeholder="Wörter oder Bibelstelle"
                        aria-label="Bibel durchsuchen"
                        @keydown.enter.prevent="onEnter"
                    />
                    <Button
                        v-if="query"
                        variant="ghost"
                        size="icon-sm"
                        class="-mr-1.5 shrink-0 text-muted-foreground"
                        aria-label="Suche löschen"
                        @click.stop="clearQuery"
                    >
                        <CircleX aria-hidden="true" />
                    </Button>
                </div>

                <Select v-model="scope">
                    <SelectTrigger class="sm:w-56" aria-label="Suchen in">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Ganze Bibel</SelectItem>
                        <SelectItem value="AT">Altes Testament</SelectItem>
                        <SelectItem value="NT">Neues Testament</SelectItem>
                        <SelectSeparator />
                        <SelectGroup v-for="t in testaments" :key="t.key">
                            <SelectLabel>{{ t.label }}</SelectLabel>
                            <SelectItem v-for="book in t.books" :key="book.slug" :value="book.slug">
                                {{ book.name }}
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="page-col pb-24 pt-3"
                :class="{ 'lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-x-8': index.length }"
            >
                <!-- Desktop: the books with hits, beside them, to jump to. -->
                <nav
                    v-if="index.length"
                    class="hidden lg:sticky lg:top-3 lg:col-start-1 lg:row-span-6 lg:block lg:max-h-[calc(100dvh-10rem)] lg:self-start lg:overflow-y-auto"
                    aria-label="Treffer nach Büchern"
                >
                    <p class="label-micro mb-1 px-2 pt-1 text-muted-foreground">Bücher</p>
                    <ul>
                        <li v-for="group in index" :key="group.book.slug">
                            <button
                                type="button"
                                class="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                                @click="jumpTo(group.book.slug)"
                            >
                                <span class="min-w-0 flex-1 truncate">{{ group.book.name }}</span>
                                <span class="text-xs text-muted-foreground">{{ group.count }}</span>
                            </button>
                        </li>
                    </ul>
                </nav>
                <div class="lg:col-start-2">
                    <!-- A typed reference goes straight to the passage; Enter does
                     the same. Above the full-text hits, which for "Joh 3,16"
                     would be noise. -->
                    <RouterLink
                        v-if="reference"
                        :to="referencePath"
                        class="mb-4 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
                    >
                        <BookOpen class="size-5 shrink-0 text-gold" aria-hidden="true" />
                        <span class="min-w-0 flex-1 text-[0.9375rem]">
                            Gehe zu
                            <span class="font-semibold">{{ referenceLabel(reference) }}</span>
                        </span>
                        <ArrowRight
                            class="size-[1.125rem] shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </RouterLink>

                    <p v-if="!terms.length" class="px-2 text-sm text-muted-foreground">
                        Geben Sie Wörter ein, die im Vers vorkommen, etwa „guter Hirte“, oder eine
                        Bibelstelle wie „Johannes 3,16“.
                    </p>

                    <template v-else>
                        <!-- First search of the session: the books are read and
                         indexed once, then kept. -->
                        <div
                            v-if="building && !complete"
                            class="mb-3 flex items-center gap-3 px-2 text-sm text-muted-foreground"
                        >
                            <Spinner size="sm" />
                            <span>
                                Die Bibel wird für die Suche vorbereitet … {{ indexedCount }} von
                                {{ BIBEL_BOOKS.length }} Büchern
                            </span>
                        </div>

                        <!-- Offline with books missing: say what was searched,
                         and offer to fetch the rest. -->
                        <div
                            v-else-if="!complete"
                            class="mb-4 rounded-lg bg-muted px-2 pb-1 pt-3 text-sm text-muted-foreground"
                        >
                            <p class="flex items-start gap-2 px-2">
                                <WifiOff class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>
                                    Durchsucht wurden {{ indexedCount }} von
                                    {{ BIBEL_BOOKS.length }} Büchern. Die übrigen sind noch nicht
                                    auf dem Gerät und ohne Internet nicht erreichbar.
                                </span>
                            </p>
                            <BibelOfflineStatus class="mt-1 text-foreground" />
                        </div>

                        <p
                            v-if="result.total > 0"
                            class="mb-2 px-2 text-[0.8125rem] text-muted-foreground"
                            aria-live="polite"
                        >
                            {{ result.total }} {{ result.total === 1 ? 'Vers' : 'Verse' }} gefunden
                            <template v-if="result.total > result.shown">
                                · die ersten {{ result.shown }} werden gezeigt
                            </template>
                        </p>
                        <p
                            v-else-if="!building || complete"
                            class="px-2 text-sm text-muted-foreground"
                            aria-live="polite"
                        >
                            Keine Verse gefunden{{
                                scope === 'all' ? '' : ` in ${scopeLabel(scope)}`
                            }}.
                        </p>

                        <section
                            v-for="group in result.groups"
                            :id="`treffer-${group.book.slug}`"
                            :key="group.book.slug"
                            class="mt-5 scroll-mt-3"
                            :aria-label="group.book.name"
                        >
                            <h2 class="flex items-baseline gap-2 px-2">
                                <span class="font-display text-xl font-semibold">
                                    {{ group.book.name }}
                                </span>
                                <span class="text-sm text-muted-foreground">{{ group.count }}</span>
                            </h2>

                            <ul v-if="group.verses.length" class="mt-1 divide-y divide-border">
                                <li
                                    v-for="hit in group.verses"
                                    :key="`${hit.chapter},${hit.verse}`"
                                >
                                    <RouterLink
                                        :to="chapterPath(hit, hit.verse)"
                                        class="block rounded-sm px-2 py-2.5 transition-colors hover:bg-muted active:bg-muted"
                                    >
                                        <span class="label-micro block text-gold">
                                            {{ verseRefLabel(hit, hit.verse) }}
                                        </span>
                                        <SearchHighlight
                                            :text="hit.text"
                                            :terms="terms"
                                            class="mt-0.5 block font-hymnal text-[0.9375rem] leading-snug"
                                        />
                                    </RouterLink>
                                </li>
                            </ul>

                            <!-- Past the cap: the count, and the way to see them. -->
                            <button
                                v-if="
                                    group.verses.length < group.count && scope !== group.book.slug
                                "
                                type="button"
                                class="mt-1 flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-primary transition-colors hover:bg-muted"
                                @click="scope = group.book.slug"
                            >
                                {{
                                    group.verses.length
                                        ? `Alle ${group.count} Treffer in ${group.book.name}`
                                        : `${group.count} Treffer – nur in ${group.book.name} suchen`
                                }}
                                <ChevronRight class="size-4 shrink-0" aria-hidden="true" />
                            </button>
                        </section>

                        <p
                            v-if="result.total > result.shown"
                            class="mt-6 px-2 text-sm text-muted-foreground"
                        >
                            Weitere {{ result.total - result.shown }} Treffer. Ein weiteres Wort
                            oder ein einzelnes Buch grenzt die Suche ein.
                        </p>
                    </template>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ArrowRight, BookOpen, ChevronRight, CircleX, Search, WifiOff } from 'lucide-vue-next';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { useBibelOffline } from '@/composables/useBibelOffline';
import { useBibelSearchIndex } from '@/composables/useBibelSearchIndex';

import BibelOfflineStatus from '@/components/bibel/BibelOfflineStatus.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import SearchHighlight from '@/components/utils/SearchHighlight.vue';

import { BIBEL_BOOKS, chapterPath, verseRefLabel } from '@/utils/bibel';
import { parseReference } from '@/utils/bibelRef';
import { type BibelScope, referenceLabel, scopeLabel, searchVerses } from '@/utils/bibelSearch';
import { searchTerms } from '@/utils/search';

const route = useRoute();
const router = useRouter();

const testaments = (['AT', 'NT'] as const).map((key) => ({
    key,
    label: key === 'AT' ? 'Altes Testament' : 'Neues Testament',
    books: BIBEL_BOOKS.filter((book) => book.testament === key),
}));

// Query and scope live in the URL: the page is not kept alive, and a reader
// who opens a verse and comes back should find the search as they left it.
function initialScope(): BibelScope {
    const value = route.query.in;
    if (typeof value !== 'string') return 'all';
    return value === 'AT' || value === 'NT' || BIBEL_BOOKS.some((b) => b.slug === value)
        ? value
        : 'all';
}

const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
const scope = ref<BibelScope>(initialScope());
const inputRef = ref<HTMLInputElement | null>(null);

// The reference answers at once; the full text waits for a pause in typing,
// so a word half typed does not scan 31,000 verses per keystroke.
const reference = computed(() => parseReference(query.value));
const referencePath = computed(() =>
    reference.value ? chapterPath(reference.value, reference.value.verse) : '',
);

const settledQuery = ref(query.value);
let debounce: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => (settledQuery.value = value), 200);
});
onBeforeUnmount(() => clearTimeout(debounce));

const terms = computed(() => searchTerms(settledQuery.value));

watch([settledQuery, scope], ([q, s]) => {
    // Kept alive inside the tab, the page goes on running after the reader
    // has left it — a query settling late must not rewrite the next page's
    // address (a chapter's ?vers=).
    if (route.name !== 'BibelSearch') return;
    router.replace({
        query: { ...(q ? { q } : {}), ...(s !== 'all' ? { in: s } : {}) },
    });
});

const { verses, indexedCount, building, complete, build } = useBibelSearchIndex();

const result = computed(() => searchVerses(verses.value, terms.value, scope.value));

/** The desktop's list of books beside the hits: worth it from two books on. */
const index = computed(() => (result.value.groups.length > 1 ? result.value.groups : []));

function jumpTo(slug: string) {
    document.getElementById(`treffer-${slug}`)?.scrollIntoView({ behavior: 'smooth' });
}

// The index is built on the first real search, not on opening the page: a
// reader who only types "Joh 3,16" should not fetch the whole Bible for it.
watch(
    terms,
    (value) => {
        if (value.length && !complete.value) build();
    },
    { immediate: true },
);

// Books that were out of reach: try again once they may not be.
function retry() {
    if (terms.value.length && !complete.value) build();
}

const offline = useBibelOffline();
watch(offline.complete, (done) => done && retry());

onMounted(() => {
    window.addEventListener('online', retry);
    inputRef.value?.focus();
});
// Back from a verse, the page is the one left behind: ready to type again.
onActivated(() => inputRef.value?.focus());
onBeforeUnmount(() => window.removeEventListener('online', retry));

function onEnter() {
    if (reference.value) {
        router.push(referencePath.value);
        return;
    }
    // Search right away, and put the keyboard away so the hits can be seen.
    clearTimeout(debounce);
    settledQuery.value = query.value;
    inputRef.value?.blur();
}

function clearQuery() {
    query.value = '';
    settledQuery.value = '';
    inputRef.value?.focus();
}
</script>
