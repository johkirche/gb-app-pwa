import { computed } from 'vue';

import { useUserStore } from '@/stores/user';

import { fetchSymbolSvg, svgDataUrl } from '@/composables/useSymbols';

import { type Profile, readProfile, updateProfile } from '@/api/profile.api';
import type { GemeindeRef } from '@/utils/gemeinden';

/** Who the reader says they are: the name, the symbol they chose, and their Gemeinde. */
export function useProfile() {
    const userStore = useUserStore();

    /** The name as one line, or null when none was given. */
    const fullName = computed(() => {
        const name = [userStore.user?.firstName, userStore.user?.lastName]
            .map((part) => part?.trim())
            .filter(Boolean)
            .join(' ');
        return name || null;
    });

    /** Two letters for the avatar when there is no symbol; the email's first without a name. */
    const initials = computed(
        () =>
            initialsOf(userStore.user?.firstName, userStore.user?.lastName) ||
            (userStore.user?.email?.[0]?.toUpperCase() ?? ''),
    );

    const avatarUrl = computed(() =>
        userStore.user?.avatarSvg ? svgDataUrl(userStore.user.avatarSvg) : null,
    );

    /** The Gemeinde the account says, or null when none was given. */
    const gemeinde = computed<GemeindeRef | null>(() =>
        userStore.user?.gemeinde
            ? { id: userStore.user.gemeinde, name: userStore.user.gemeindeName ?? '' }
            : null,
    );

    /**
     * Save a new name, symbol or Gemeinde, and say whether the server took it.
     * Only what changed is sent; nothing changed is a success with no request.
     * The device shows the new profile only once Directus has it, so a refused
     * write never leaves the app showing a name the account does not have.
     */
    async function saveProfile(next: {
        firstName?: string;
        lastName?: string;
        avatar?: string | null;
        gemeinde?: GemeindeRef | null;
    }): Promise<boolean> {
        const user = userStore.user;

        const patch: Partial<Profile> = {};
        if (next.firstName !== undefined && clean(next.firstName) !== clean(user?.firstName)) {
            patch.firstName = clean(next.firstName);
        }
        if (next.lastName !== undefined && clean(next.lastName) !== clean(user?.lastName)) {
            patch.lastName = clean(next.lastName);
        }
        if (next.avatar !== undefined && next.avatar !== (user?.avatar ?? null)) {
            patch.avatar = next.avatar;
        }
        if (
            next.gemeinde !== undefined &&
            (next.gemeinde?.id ?? null) !== (user?.gemeinde ?? null)
        ) {
            patch.gemeinde = next.gemeinde?.id ?? null;
            patch.gemeindeName = next.gemeinde?.name ?? null;
        }
        // Nothing to say is nothing that can fail — with or without a session.
        if (Object.keys(patch).length === 0) return true;
        if (!user) return false;

        // The picture first: a symbol the device cannot keep is not worth
        // writing to the account, where every other device would then miss it.
        let avatarSvg: string | null | undefined;
        if ('avatar' in patch) {
            try {
                avatarSvg = patch.avatar ? await fetchSymbolSvg(patch.avatar) : null;
            } catch (err) {
                console.warn('Could not fetch the chosen symbol:', err);
                return false;
            }
        }

        if (!(await updateProfile(patch))) return false;

        await userStore.patchUser({
            ...('firstName' in patch && { firstName: patch.firstName ?? undefined }),
            ...('lastName' in patch && { lastName: patch.lastName ?? undefined }),
            ...('avatar' in patch && { avatar: patch.avatar, avatarSvg }),
            ...('gemeinde' in patch && {
                gemeinde: patch.gemeinde,
                gemeindeName: patch.gemeindeName,
            }),
        });
        return true;
    }

    /**
     * Bring the device in line with the account: a name, symbol or Gemeinde
     * changed on another device, or a symbol this one has not got the picture of yet.
     * Quiet when the profile cannot be read — what the device has stays.
     */
    async function pullProfile(): Promise<void> {
        const profile = await readProfile();
        const user = userStore.user;
        if (!profile || !user) return;

        let avatarSvg = user.avatarSvg ?? null;
        if (profile.avatar !== (user.avatar ?? null) || (profile.avatar && !avatarSvg)) {
            if (!profile.avatar) {
                avatarSvg = null;
            } else {
                try {
                    avatarSvg = await fetchSymbolSvg(profile.avatar);
                } catch (err) {
                    console.warn('Could not fetch the profile’s symbol:', err);
                    return;
                }
            }
        }

        await userStore.patchUser({
            firstName: profile.firstName ?? undefined,
            lastName: profile.lastName ?? undefined,
            avatar: profile.avatar,
            avatarSvg,
            gemeinde: profile.gemeinde,
            gemeindeName: profile.gemeindeName,
        });
    }

    return { fullName, initials, avatarUrl, gemeinde, saveProfile, pullProfile };
}

/** A name part as Directus should store it: trimmed, and absent rather than empty. */
function clean(value: string | null | undefined): string | null {
    return value?.trim() || null;
}

/** The first letter of each name given, upper-cased: „EM" for Erika Muster. */
export function initialsOf(firstName?: string | null, lastName?: string | null): string {
    return [firstName, lastName]
        .map((part) => part?.trim()?.[0] ?? '')
        .join('')
        .toUpperCase();
}
