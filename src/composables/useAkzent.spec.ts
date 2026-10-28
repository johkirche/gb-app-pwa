import { beforeEach, describe, expect, it, vi } from 'vitest';

// The composable holds its state at module level, read from localStorage on
// import — so each test imports a fresh copy after arranging the storage.
async function load() {
    vi.resetModules();
    return (await import('@/composables/useAkzent')).useAkzent();
}

describe('useAkzent', () => {
    beforeEach(() => {
        localStorage.clear();
        delete document.documentElement.dataset.akzent;
    });

    it('is silver until the reader chooses', async () => {
        const { akzent, initAkzent } = await load();
        initAkzent();
        expect(akzent.value).toBe('silber');
        expect(document.documentElement.dataset.akzent).toBe('silber');
    });

    it('keeps what was chosen, across a reload', async () => {
        (await load()).setAkzent('gold');
        expect(localStorage.getItem('settings.akzent')).toBe('gold');
        expect(document.documentElement.dataset.akzent).toBe('gold');

        delete document.documentElement.dataset.akzent;
        const { akzent, initAkzent } = await load();
        initAkzent();
        expect(akzent.value).toBe('gold');
        expect(document.documentElement.dataset.akzent).toBe('gold');
    });

    it('ignores a stored value it does not know', async () => {
        localStorage.setItem('settings.akzent', 'kupfer');
        const { akzent } = await load();
        expect(akzent.value).toBe('silber');
    });
});
