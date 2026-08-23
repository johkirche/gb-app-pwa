import { computed, readonly, ref, shallowRef } from 'vue';

/**
 * The connected MIDI instrument, if the reader has asked for one.
 *
 * Opt-in by design. Since Chrome 124 *every* Web MIDI call raises a permission
 * prompt — it used to be sysex-only — so an app that touches
 * `requestMIDIAccess()` on startup greets everyone with a dialog about
 * hardware they do not own. Nothing here calls it until the setting is turned
 * on, and the turning-on is the gesture that asks.
 *
 * On later starts the permission is read through the Permissions API, which
 * answers without prompting: already granted means the device list can be
 * rebuilt silently, anything else means we stay dark until asked again.
 *
 * Not available on iPhone or iPad at all — Safari implements no Web MIDI, on
 * any version. The settings section says so rather than showing an empty
 * picker.
 *
 * Module state, like the wake lock: MIDI access is one grant per document, and
 * the settings picker and the playback engine must see the same device.
 */

export type MidiPermission = 'unsupported' | 'unknown' | 'prompt' | 'granted' | 'denied';

export interface MidiOutputInfo {
    id: string;
    name: string;
    manufacturer: string;
}

const permission = ref<MidiPermission>('unknown');
const access = shallowRef<MIDIAccess | null>(null);
const outputs = ref<MidiOutputInfo[]>([]);
const accessError = ref<string | null>(null);

// A projection of the two stored preferences, pushed in by `syncMidiPreference`.
// The preferences store stays the single owner of what is *saved*; this is only
// what the device layer currently acts on.
const enabled = ref(false);
const selectedId = ref('');

let inFlight: Promise<boolean> | null = null;

export function isMidiSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

/** Read the permission without asking for it. Never raises a prompt. */
export async function readMidiPermission(): Promise<MidiPermission> {
    if (!isMidiSupported()) {
        permission.value = 'unsupported';
        return permission.value;
    }
    try {
        const status = await navigator.permissions.query({ name: 'midi' });
        permission.value = status.state;
        // A grant revoked in the browser's site settings must take the device
        // list down with it.
        status.onchange = () => {
            permission.value = status.state;
            if (status.state !== 'granted') {
                access.value = null;
                refreshOutputs();
            }
        };
    } catch {
        // Firefox rejects unknown permission names, and some engines have no
        // Permissions API at all. Unknown means "ask when the reader asks".
        permission.value = 'unknown';
    }
    return permission.value;
}

function refreshOutputs() {
    const current = access.value;
    if (!current) {
        outputs.value = [];
        return;
    }
    const list: MidiOutputInfo[] = [];
    current.outputs.forEach((output) => {
        list.push({
            id: output.id,
            name: output.name || 'Unbekanntes Gerät',
            manufacturer: output.manufacturer || '',
        });
    });
    outputs.value = list;
}

async function openAccess(): Promise<boolean> {
    if (access.value) return true;
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            // sysex stays off: nothing here needs it, and it is the scarier half
            // of the permission dialog.
            const granted = await navigator.requestMIDIAccess({ sysex: false });
            access.value = granted;
            permission.value = 'granted';
            accessError.value = null;
            refreshOutputs();
            // Plugging a keyboard in mid-service must not need a reload.
            granted.onstatechange = () => refreshOutputs();
            return true;
        } catch (err) {
            console.error('MIDI access failed:', err);
            accessError.value = 'Der Zugriff auf MIDI-Geräte wurde nicht erteilt.';
            permission.value = 'denied';
            return false;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/**
 * Ask for MIDI access. Call this only from a user gesture — it is the one path
 * here that may raise the browser's permission prompt.
 */
export async function requestMidiAccess(): Promise<boolean> {
    if (!isMidiSupported()) {
        permission.value = 'unsupported';
        return false;
    }
    return openAccess();
}

/**
 * Bring the device layer in line with the stored settings. Re-opens access only
 * when the permission already stands, so a restart never prompts.
 */
export async function syncMidiPreference(on: boolean, deviceId: string): Promise<void> {
    enabled.value = on;
    selectedId.value = deviceId;

    if (!on) {
        access.value = null;
        outputs.value = [];
        return;
    }
    if (!isMidiSupported()) {
        permission.value = 'unsupported';
        return;
    }
    const state = await readMidiPermission();
    if (state === 'granted') await openAccess();
}

/**
 * The output the playback engine should send to, or null for the built-in
 * soundfont. Deliberately not reactive: it is read once, when an engine is
 * built. Watch `midiRouteKey` to learn that it has changed.
 */
export function activeMidiOutput(): MIDIOutput | null {
    if (!enabled.value || !access.value) return null;
    const chosen = selectedId.value
        ? access.value.outputs.get(selectedId.value)
        : // Nothing chosen yet and exactly one instrument connected: that is
          // plainly the one meant.
          onlyOutput();
    return chosen ?? null;
}

function onlyOutput(): MIDIOutput | null {
    const current = access.value;
    if (!current || current.outputs.size !== 1) return null;
    let single: MIDIOutput | null = null;
    current.outputs.forEach((output) => {
        single = output;
    });
    return single;
}

/**
 * Identifies where playback currently goes. Changes exactly when the engine
 * needs rebuilding — a component can watch this without knowing the details.
 */
export const midiRouteKey = computed(() => {
    if (!enabled.value || !access.value) return 'soundfont';
    const chosen = selectedId.value || (outputs.value.length === 1 ? outputs.value[0].id : '');
    return chosen && access.value.outputs.has(chosen) ? `midi:${chosen}` : 'soundfont';
});

/** Reactive view for the settings UI. */
export function useMidiOutput() {
    return {
        isSupported: isMidiSupported(),
        permission: readonly(permission),
        outputs: readonly(outputs),
        selectedId: readonly(selectedId),
        accessError: readonly(accessError),
        hasAccess: computed(() => access.value !== null),
        readMidiPermission,
        requestMidiAccess,
    };
}
