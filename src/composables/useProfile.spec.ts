import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserData } from '@/db';

/**
 * The profile as the device holds it. What these pin: only what changed is
 * written, the device shows a new name or symbol only once the account has
 * it, and a symbol the device could not fetch is never written to the
 * account — every other device would be left without its picture.
 */

const readProfile = vi.fn();
const updateProfile = vi.fn();
const fetchSymbolSvg = vi.fn();
const patchUser = vi.fn();

const store = { user: null as UserData | null, patchUser: (...a: unknown[]) => patchUser(...a) };

vi.mock('@/api/profile.api', () => ({
    readProfile: (...a: unknown[]) => readProfile(...a),
    updateProfile: (...a: unknown[]) => updateProfile(...a),
}));
vi.mock('@/composables/useSymbols', () => ({
    fetchSymbolSvg: (...a: unknown[]) => fetchSymbolSvg(...a),
    svgDataUrl: (svg: string) => `data:${svg}`,
}));
vi.mock('@/stores/user', () => ({ useUserStore: () => store }));

const { initialsOf, useProfile } = await import('@/composables/useProfile');

function user(over: Partial<UserData> = {}): UserData {
    return { id: 'u1', email: 'erika@example.org', role: 'activated', activated: true, ...over };
}

beforeEach(() => {
    vi.clearAllMocks();
    store.user = user({ firstName: 'Erika', lastName: 'Muster' });
});

describe('saveProfile', () => {
    it('writes only what changed, trimmed, and empty as nothing', async () => {
        updateProfile.mockResolvedValue(true);
        const ok = await useProfile().saveProfile({
            firstName: ' Erika ',
            lastName: '',
            avatar: null,
        });
        expect(ok).toBe(true);
        expect(updateProfile).toHaveBeenCalledWith({ lastName: null });
        expect(patchUser).toHaveBeenCalledWith({ lastName: undefined });
    });

    it('sends nothing when nothing changed', async () => {
        const ok = await useProfile().saveProfile({ firstName: 'Erika', lastName: 'Muster' });
        expect(ok).toBe(true);
        expect(updateProfile).not.toHaveBeenCalled();
        expect(patchUser).not.toHaveBeenCalled();
    });

    it('keeps the device as it was when the account refuses', async () => {
        updateProfile.mockResolvedValue(false);
        const ok = await useProfile().saveProfile({ firstName: 'Erika', lastName: 'Musterfrau' });
        expect(ok).toBe(false);
        expect(patchUser).not.toHaveBeenCalled();
    });

    it('fetches the symbol before writing it, and keeps the picture with the user', async () => {
        fetchSymbolSvg.mockResolvedValue('<svg/>');
        updateProfile.mockResolvedValue(true);
        expect(await useProfile().saveProfile({ avatar: 'taube' })).toBe(true);
        expect(updateProfile).toHaveBeenCalledWith({ avatar: 'taube' });
        expect(patchUser).toHaveBeenCalledWith({ avatar: 'taube', avatarSvg: '<svg/>' });
    });

    it('never writes a symbol the device could not fetch', async () => {
        fetchSymbolSvg.mockRejectedValue(new Error('offline'));
        expect(await useProfile().saveProfile({ avatar: 'taube' })).toBe(false);
        expect(updateProfile).not.toHaveBeenCalled();
    });

    it('writes the Gemeinde by its id, and keeps its name with the user', async () => {
        updateProfile.mockResolvedValue(true);
        const ok = await useProfile().saveProfile({ gemeinde: { id: 'g1', name: 'Bremen' } });
        expect(ok).toBe(true);
        expect(updateProfile).toHaveBeenCalledWith({ gemeinde: 'g1', gemeindeName: 'Bremen' });
        expect(patchUser).toHaveBeenCalledWith({ gemeinde: 'g1', gemeindeName: 'Bremen' });
        expect(fetchSymbolSvg).not.toHaveBeenCalled();
    });

    it('clears a Gemeinde taken back', async () => {
        store.user = user({ gemeinde: 'g1', gemeindeName: 'Bremen' });
        updateProfile.mockResolvedValue(true);
        expect(await useProfile().saveProfile({ gemeinde: null })).toBe(true);
        expect(updateProfile).toHaveBeenCalledWith({ gemeinde: null, gemeindeName: null });
        expect(patchUser).toHaveBeenCalledWith({ gemeinde: null, gemeindeName: null });
    });

    it('sends nothing for the Gemeinde it already has', async () => {
        store.user = user({ gemeinde: 'g1', gemeindeName: 'Bremen' });
        const ok = await useProfile().saveProfile({ gemeinde: { id: 'g1', name: 'Bremen' } });
        expect(ok).toBe(true);
        expect(updateProfile).not.toHaveBeenCalled();
    });

    it('sends nothing for no Gemeinde on an account without one', async () => {
        expect(await useProfile().saveProfile({ gemeinde: null })).toBe(true);
        expect(updateProfile).not.toHaveBeenCalled();
    });
});

describe('gemeinde', () => {
    it('reads the id and the name off the user', () => {
        store.user = user({ gemeinde: 'g1', gemeindeName: 'Bremen' });
        expect(useProfile().gemeinde.value).toEqual({ id: 'g1', name: 'Bremen' });
    });

    it('is null without one', () => {
        expect(useProfile().gemeinde.value).toBeNull();
    });
});

describe('pullProfile', () => {
    it('brings down a Gemeinde chosen on another device', async () => {
        readProfile.mockResolvedValue({
            firstName: 'Erika',
            lastName: 'Muster',
            avatar: null,
            gemeinde: 'g1',
            gemeindeName: 'Bremen',
        });
        await useProfile().pullProfile();
        expect(patchUser).toHaveBeenCalledWith(
            expect.objectContaining({ gemeinde: 'g1', gemeindeName: 'Bremen' }),
        );
    });

    it('fetches the picture of a symbol chosen on another device', async () => {
        readProfile.mockResolvedValue({ firstName: 'Erika', lastName: 'Muster', avatar: 'anker' });
        fetchSymbolSvg.mockResolvedValue('<svg id="anker"/>');
        await useProfile().pullProfile();
        expect(fetchSymbolSvg).toHaveBeenCalledWith('anker');
        expect(patchUser).toHaveBeenCalledWith(
            expect.objectContaining({ avatar: 'anker', avatarSvg: '<svg id="anker"/>' }),
        );
    });

    it('does not fetch the picture it already has', async () => {
        store.user = user({ avatar: 'anker', avatarSvg: '<svg/>' });
        readProfile.mockResolvedValue({ firstName: null, lastName: null, avatar: 'anker' });
        await useProfile().pullProfile();
        expect(fetchSymbolSvg).not.toHaveBeenCalled();
    });

    it('leaves the device alone when the profile cannot be read', async () => {
        store.user = user({ avatar: 'anker', avatarSvg: '<svg/>' });
        readProfile.mockResolvedValue(null);
        await useProfile().pullProfile();
        expect(patchUser).not.toHaveBeenCalled();
    });
});

describe('initials', () => {
    it('takes a letter from each name, and the email’s without one', () => {
        expect(initialsOf('erika', 'Muster')).toBe('EM');
        expect(initialsOf(' ', undefined)).toBe('');
        store.user = user();
        expect(useProfile().initials.value).toBe('E');
    });
});
