import { db } from '@/db';
import { META_KEYS } from '@/db/metaKeys';

import { notifyLocalChange } from './repo';

// The profile API is loaded when a sync needs it, not with this module: the
// settings' owners (useTheme, utils/bibel, the stores) register here while the
// app is still loading, and a static import would pull the whole auth chain in
// behind them — and back round to them.
const profileApi = () => import('@/api/profile.api');

/**
 * The reader's settings on the account, setting by setting.
 *
 * They travel in the profile's `app_settings`, under `synced`: each one with the
 * moment it was last set, `{ "theme": { "v": "dark", "at": "…" } }`, so two
 * devices that changed different settings both keep their change, and of two
 * that changed the same one the later wins. Settings that belong to the device
 * rather than the reader — the page size, the MIDI output — are never
 * registered here and stay where they are.
 *
 * Whoever owns a setting registers how to read and apply it; a change is
 * reported with markSettingChanged.
 */

interface SyncedSetting {
    read: () => unknown | Promise<unknown>;
    apply: (value: unknown) => void | Promise<void>;
}

/** A setting on the account: its value, and when it was set. */
interface Stamped {
    v: unknown;
    at: string;
}

/** On the device: when each setting was last set, and whether that is uploaded. */
type LocalState = Record<string, { at: string; dirty?: boolean }>;

const STATE_KEY = META_KEYS.syncedSettings;
const PROFILE_KEY = 'synced';

const registry = new Map<string, SyncedSetting>();

export function registerSyncedSetting(key: string, setting: SyncedSetting): void {
    registry.set(key, setting);
}

async function readState(): Promise<LocalState> {
    try {
        const row = await db.meta.get(STATE_KEY);
        return row ? (JSON.parse(row.value) as LocalState) : {};
    } catch {
        return {};
    }
}

async function writeState(state: LocalState): Promise<void> {
    await db.meta.put({ key: STATE_KEY, value: JSON.stringify(state) });
}

/** Note that the reader changed a setting here; the sync takes it up. */
export async function markSettingChanged(key: string): Promise<void> {
    // Best effort, like the setting's own save: the reader's change is made
    // either way, and a lost mark only means it travels with the next one.
    try {
        const state = await readState();
        state[key] = { at: new Date().toISOString(), dirty: true };
        await writeState(state);
        notifyLocalChange();
    } catch (err) {
        console.warn(`Could not note the change to ${key} for the sync:`, err);
    }
}

export async function pendingSettings(): Promise<number> {
    const state = await readState();
    return Object.values(state).filter((s) => s.dirty).length;
}

/**
 * Bring the settings on the device and the account together. Returns whether
 * anything from the account was applied here. Throws only what the profile API
 * throws; a profile that cannot be read just leaves things for the next time.
 */
export async function syncSettings(): Promise<boolean> {
    const { readAppSettings, updateAppSettings } = await profileApi();
    const profile = await readAppSettings();
    if (!profile) return false;

    const remote = (profile[PROFILE_KEY] ?? {}) as Record<string, Stamped>;
    const state = await readState();
    const outgoing: Record<string, Stamped> = {};
    let applied = false;

    for (const [key, setting] of registry) {
        const r = remote[key] && typeof remote[key].at === 'string' ? remote[key] : undefined;
        const l = state[key];

        if (r && (!l || r.at > l.at)) {
            // Set later on another device, or never here: take it.
            try {
                await setting.apply(r.v);
                state[key] = { at: r.at };
                applied = true;
            } catch (err) {
                console.warn(`Could not apply the setting ${key}:`, err);
            }
        } else if (l?.dirty) {
            // Set here, and later than anywhere else: hand it up.
            outgoing[key] = { v: await setting.read(), at: l.at };
        }
        // A setting nobody has set since the sync existed stays where it is.
        // Uploading what a device merely has would write to the account on
        // every first start — and would let a fresh install's defaults stand
        // in for choices the reader made elsewhere. It travels once it is set.
    }

    if (Object.keys(outgoing).length > 0) {
        const merged = { ...remote, ...outgoing };
        if (await updateAppSettings({ [PROFILE_KEY]: merged })) {
            for (const key of Object.keys(outgoing)) state[key] = { at: outgoing[key].at };
        }
    }
    await writeState(state);
    return applied;
}

// The reading plan follows the reader: started on the tablet, ticked off on
// the phone. Kept here rather than with the store, which exists only once the
// Bible has been opened — the plan has to arrive regardless.
registerSyncedSetting('readingPlan', {
    read: async () => (await db.leseplaene.toArray())[0] ?? null,
    apply: async (value) => {
        if (value === null) {
            await db.leseplaene.clear();
            return;
        }
        const plan = value as { id?: unknown; startedOn?: unknown; doneDays?: unknown };
        if (
            typeof plan?.id !== 'string' ||
            typeof plan.startedOn !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(plan.startedOn) ||
            !Array.isArray(plan.doneDays)
        ) {
            return;
        }
        const doneDays = plan.doneDays.filter((d): d is number => Number.isInteger(d) && d >= 1);
        await db.transaction('rw', db.leseplaene, async () => {
            await db.leseplaene.clear();
            await db.leseplaene.put({
                id: plan.id as string,
                startedOn: plan.startedOn as string,
                doneDays,
            });
        });
    },
});

/** On logout, or when another account takes the device over. */
export async function forgetSettingsState(): Promise<void> {
    await db.meta.delete(STATE_KEY);
}
