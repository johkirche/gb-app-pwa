import { reactive, ref, shallowRef } from 'vue';

import { fetchFile, listFolderFiles } from '@/api/files.api';
import { SYMBOL_FOLDER_ID } from '@/config/symbols';
import { type SymbolFile, type SymbolOption, toSymbols } from '@/utils/symbols';

/**
 * The Gesangbuch's symbols, for the picker: the folder's list, and the
 * roundels themselves as they arrive.
 *
 * Held at module level, so the onboarding and the Einstellungen share one copy
 * and reopening the picker never fetches the same file twice in a session.
 * Nothing of it is stored: the device keeps only the symbol a reader chose,
 * with their user (see useProfile). The rest is two megabytes for a choice
 * made once.
 */

const FIELDS = ['id', 'title', 'filename_download'];

/** At once, of 32: enough to fill the grid quickly, few enough not to queue the book's download. */
const PARALLEL = 4;

const symbols = shallowRef<SymbolOption[]>([]);
const listState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
/** id → a data: URL of the roundel, filled in as each arrives. */
const images = reactive<Record<string, string>>({});
const imagesFailed = ref(false);

const svgs = new Map<string, Promise<string>>();
let listRun: Promise<void> | null = null;
let imagesRun: Promise<void> | null = null;

/** An SVG as an <img> source: drawn as a picture, so nothing in it can run. */
export function svgDataUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * One symbol's SVG. Shared between the grid and the save, so choosing one that
 * is already on screen costs nothing more; a failure is forgotten, so the next
 * ask tries again.
 */
export function fetchSymbolSvg(id: string): Promise<string> {
    let run = svgs.get(id);
    if (!run) {
        run = fetchFile(id).then((blob) => blob.text());
        run.catch(() => svgs.delete(id));
        svgs.set(id, run);
    }
    return run;
}

function loadList(): Promise<void> {
    if (listState.value === 'ready') return Promise.resolve();
    if (!listRun) {
        listState.value = 'loading';
        listRun = listFolderFiles<SymbolFile>(SYMBOL_FOLDER_ID, FIELDS)
            .then((files) => {
                symbols.value = toSymbols(files);
                listState.value = 'ready';
            })
            .catch((err) => {
                console.warn('Could not list the symbols:', err);
                listState.value = 'error';
            })
            .finally(() => {
                listRun = null;
            });
    }
    return listRun;
}

function loadImages(): Promise<void> {
    if (!imagesRun) {
        imagesFailed.value = false;
        const queue = symbols.value.filter((s) => !images[s.id]);
        const worker = async () => {
            for (let next = queue.shift(); next; next = queue.shift()) {
                try {
                    images[next.id] = svgDataUrl(await fetchSymbolSvg(next.id));
                } catch (err) {
                    console.warn(`Could not load symbol ${next.id}:`, err);
                    imagesFailed.value = true;
                }
            }
        };
        imagesRun = Promise.all(Array.from({ length: PARALLEL }, worker))
            .then(() => undefined)
            .finally(() => {
                imagesRun = null;
            });
    }
    return imagesRun;
}

export function useSymbols() {
    return {
        symbols,
        listState,
        images,
        imagesFailed,
        /** The list, then every roundel not yet in hand. */
        async loadAll() {
            await loadList();
            if (listState.value === 'ready') await loadImages();
        },
    };
}
