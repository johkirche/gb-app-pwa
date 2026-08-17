import { readonly, ref } from 'vue';

export interface ConfirmOptions {
    title: string;
    message?: string;
    /** Label of the confirming button. @default 'OK' */
    confirmText?: string;
    /**
     * Label of the cancel button. Pass `null` to hide it (info-only dialog).
     * @default 'Abbrechen'
     */
    cancelText?: string | null;
    /** Style the confirming button like the destructive Button variant. */
    destructive?: boolean;
}

interface ConfirmRequest {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string | null;
    destructive: boolean;
    resolve: (confirmed: boolean) => void;
}

/** Grace period between a dialog closing and the next queued one opening (exit animation). */
const REOPEN_DELAY_MS = 200;

const isOpen = ref(false);
// Kept set while the close animation plays so the dialog text does not blank out mid-fade.
const current = ref<ConfirmRequest | null>(null);

const queue: ConfirmRequest[] = [];
let settled = true;
let reopenTimer: ReturnType<typeof setTimeout> | undefined;

function show(request: ConfirmRequest) {
    current.value = request;
    settled = false;
    isOpen.value = true;
}

function pump() {
    if (isOpen.value || !settled || reopenTimer !== undefined) return;
    const next = queue.shift();
    if (!next) return;
    if (current.value) {
        // A dialog just closed; let its exit animation finish before reopening.
        reopenTimer = setTimeout(() => {
            reopenTimer = undefined;
            show(next);
        }, REOPEN_DELAY_MS);
    } else {
        show(next);
    }
}

function settle(confirmed: boolean) {
    if (settled || !current.value) return;
    settled = true;
    isOpen.value = false;
    current.value.resolve(confirmed);
    pump();
}

/**
 * Promise-based replacement for Ionic alertController confirms.
 * Requires a single `<ConfirmHost />` mounted at the app root.
 *
 * ```ts
 * const { confirm } = useConfirm();
 * if (await confirm({ title: 'Lied löschen?', destructive: true })) { ... }
 * ```
 */
export function useConfirm() {
    function confirm(options: ConfirmOptions): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            queue.push({
                title: options.title,
                message: options.message ?? '',
                confirmText: options.confirmText ?? 'OK',
                // `??` would swallow the explicit `null` (= hide cancel button).
                cancelText: options.cancelText === undefined ? 'Abbrechen' : options.cancelText,
                destructive: options.destructive ?? false,
                resolve,
            });
            pump();
        });
    }

    return { confirm };
}

/** Internal wiring for ConfirmHost.vue — use useConfirm() in feature code. */
export function useConfirmHost() {
    function onOpenChange(open: boolean) {
        if (open) return;
        const request = current.value;
        isOpen.value = false;
        // Reka's Action/Cancel buttons close the dialog *before* our own click
        // handler runs, so the explicit result (confirm/cancel) arrives later in
        // the same tick. Defer the default: if nothing settled this request by
        // the end of the tick, the dialog was dismissed (Escape) -> cancel.
        queueMicrotask(() => {
            if (current.value === request) settle(false);
        });
    }

    function onConfirm() {
        settle(true);
    }

    function onCancel() {
        settle(false);
    }

    return {
        isOpen: readonly(isOpen),
        current: readonly(current),
        onOpenChange,
        onConfirm,
        onCancel,
    };
}
