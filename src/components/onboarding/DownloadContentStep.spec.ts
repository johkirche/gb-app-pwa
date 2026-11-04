import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import DownloadContentStep from './DownloadContentStep.vue';

/**
 * The download is a step of its own: the app has nothing to show without the
 * book, so the one way on opens when the book is down, and the only other way
 * out is the one a failed download leaves. sync.spec walks this end to end, but
 * only with a recording; this holds in every clone.
 */

const AT_START = {
    isSyncing: false,
    downloadStarted: false,
    syncError: null,
    syncProgress: { phase: 'idle', current: 0, total: 0 },
    downloadComplete: false,
    failedCount: 0,
    storageEstimate: null,
};

function buttons(props: Partial<typeof AT_START> | Record<string, unknown>) {
    const wrapper = mount(DownloadContentStep, { props: { ...AT_START, ...props } });
    const find = (label: string) =>
        wrapper.findAll('button').find((button) => button.text().includes(label));
    return { wrapper, find, labels: wrapper.findAll('button').map((b) => b.text()) };
}

describe('the download step', () => {
    it('waits for „Herunterladen" where the reader is asked first', async () => {
        const { wrapper, find, labels } = buttons({});
        expect(labels).toEqual(['Herunterladen']);

        await find('Herunterladen')?.trigger('click');
        expect(wrapper.emitted('download')).toHaveLength(1);
    });

    it('offers no way on while the book is coming down', () => {
        const { labels } = buttons({
            isSyncing: true,
            downloadStarted: true,
            syncProgress: { phase: 'files', current: 340, total: 1121 },
        });
        expect(labels).toEqual([]);
    });

    it('goes on once the book is down', async () => {
        const { wrapper, find, labels } = buttons({
            downloadStarted: true,
            downloadComplete: true,
        });
        expect(labels).toEqual(['Weiter']);

        await find('Weiter')?.trigger('click');
        expect(wrapper.emitted('next')).toHaveLength(1);
    });

    it('offers the retry and a way out when files failed, and no „Weiter"', async () => {
        const { wrapper, find, labels } = buttons({ downloadStarted: true, failedCount: 3 });
        expect(labels).toEqual(['Erneut versuchen', 'Später fortfahren']);

        await find('Erneut versuchen')?.trigger('click');
        expect(wrapper.emitted('retry')).toHaveLength(1);

        await find('Später fortfahren')?.trigger('click');
        expect(wrapper.emitted('skip')).toHaveLength(1);
        expect(wrapper.emitted('next')).toBeUndefined();
    });

    it('retries the whole download when it failed before any file', async () => {
        const { wrapper, find } = buttons({ downloadStarted: true, syncError: 'offline' });

        await find('Erneut versuchen')?.trigger('click');
        expect(wrapper.emitted('download')).toHaveLength(1);
        expect(find('Später fortfahren')).toBeDefined();
    });
});
