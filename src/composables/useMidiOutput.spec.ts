import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as MidiModule from '@/composables/useMidiOutput';

function makeOutput(id: string) {
    return { id, name: `Keyboard ${id}`, manufacturer: 'ACME', send: vi.fn() };
}

function makeAccess(ids: string[]) {
    return {
        outputs: new Map(ids.map((id) => [id, makeOutput(id)])),
        onstatechange: null as (() => void) | null,
    };
}

let requestMIDIAccess: ReturnType<typeof vi.fn>;
let query: ReturnType<typeof vi.fn>;
let permissionStatus: { state: string; onchange: (() => void) | null };
let midi: typeof MidiModule;

async function load(options: { supported?: boolean; permission?: string } = {}) {
    const { supported = true, permission = 'prompt' } = options;
    vi.resetModules();

    permissionStatus = { state: permission, onchange: null };
    query = vi.fn(async () => permissionStatus);
    requestMIDIAccess = vi.fn(async () => makeAccess(['out-1']));

    if (supported) {
        Object.defineProperty(navigator, 'requestMIDIAccess', {
            value: requestMIDIAccess,
            configurable: true,
        });
    } else {
        Reflect.deleteProperty(navigator, 'requestMIDIAccess');
    }
    Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true });

    midi = await import('@/composables/useMidiOutput');
    return midi;
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    Reflect.deleteProperty(navigator, 'requestMIDIAccess');
    Reflect.deleteProperty(navigator, 'permissions');
});

describe('useMidiOutput – nur auf Wunsch', () => {
    it('fragt nichts ab, solange die Einstellung aus ist', async () => {
        const { syncMidiPreference, activeMidiOutput } = await load();

        await syncMidiPreference(false, '');

        expect(requestMIDIAccess).not.toHaveBeenCalled();
        expect(query).not.toHaveBeenCalled();
        expect(activeMidiOutput()).toBeNull();
    });

    it('fragt beim Start nicht nach, wenn die Erlaubnis noch aussteht', async () => {
        const { syncMidiPreference, activeMidiOutput } = await load({ permission: 'prompt' });

        await syncMidiPreference(true, '');

        // Der Status darf gelesen werden — das löst keinen Dialog aus.
        expect(query).toHaveBeenCalledWith({ name: 'midi' });
        // Der Dialog selbst bleibt aus.
        expect(requestMIDIAccess).not.toHaveBeenCalled();
        expect(activeMidiOutput()).toBeNull();
    });

    it('nimmt eine bereits erteilte Erlaubnis beim Start wieder auf', async () => {
        const { syncMidiPreference, activeMidiOutput } = await load({ permission: 'granted' });

        await syncMidiPreference(true, 'out-1');

        expect(requestMIDIAccess).toHaveBeenCalledWith({ sysex: false });
        expect(activeMidiOutput()?.id).toBe('out-1');
    });

    it('fragt erst, wenn ausdrücklich danach verlangt wird', async () => {
        const { requestMidiAccess, syncMidiPreference, activeMidiOutput } = await load({
            permission: 'prompt',
        });
        await syncMidiPreference(true, 'out-1');
        expect(requestMIDIAccess).not.toHaveBeenCalled();

        await requestMidiAccess();

        expect(requestMIDIAccess).toHaveBeenCalledTimes(1);
        expect(activeMidiOutput()?.id).toBe('out-1');
    });

    it('nimmt das einzige angeschlossene Gerät, wenn keines gewählt wurde', async () => {
        const { syncMidiPreference, activeMidiOutput, midiRouteKey } = await load({
            permission: 'granted',
        });

        await syncMidiPreference(true, '');

        expect(activeMidiOutput()?.id).toBe('out-1');
        expect(midiRouteKey.value).toBe('midi:out-1');
    });

    it('spielt über den Soundfont, wenn das gemerkte Gerät nicht mehr da ist', async () => {
        const { syncMidiPreference, activeMidiOutput, midiRouteKey } = await load({
            permission: 'granted',
        });

        await syncMidiPreference(true, 'ein-anderes-keyboard');

        expect(activeMidiOutput()).toBeNull();
        expect(midiRouteKey.value).toBe('soundfont');
    });

    it('gibt das Gerät wieder her, wenn die Einstellung ausgeschaltet wird', async () => {
        const { syncMidiPreference, activeMidiOutput, midiRouteKey } = await load({
            permission: 'granted',
        });
        await syncMidiPreference(true, 'out-1');
        expect(activeMidiOutput()).not.toBeNull();

        await syncMidiPreference(false, 'out-1');

        expect(activeMidiOutput()).toBeNull();
        expect(midiRouteKey.value).toBe('soundfont');
    });

    it('bleibt ohne Web MIDI folgenlos (Safari, iPhone und iPad)', async () => {
        const { syncMidiPreference, requestMidiAccess, isMidiSupported, useMidiOutput } =
            await load({ supported: false });

        expect(isMidiSupported()).toBe(false);
        await syncMidiPreference(true, 'out-1');
        expect(await requestMidiAccess()).toBe(false);
        expect(useMidiOutput().permission.value).toBe('unsupported');
    });

    it('lässt das Gerät fallen, wenn die Erlaubnis nachträglich entzogen wird', async () => {
        const { syncMidiPreference, activeMidiOutput } = await load({ permission: 'granted' });
        await syncMidiPreference(true, 'out-1');
        expect(activeMidiOutput()).not.toBeNull();

        permissionStatus.state = 'denied';
        permissionStatus.onchange?.();

        expect(activeMidiOutput()).toBeNull();
    });
});
