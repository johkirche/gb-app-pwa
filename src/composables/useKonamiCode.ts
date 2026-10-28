import { onMounted, onUnmounted } from 'vue';

const SEQUENCE = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
];

/** Whether the keys so far, newest last, end in the whole sequence. */
export function endsInKonamiCode(keys: readonly string[]): boolean {
    if (keys.length < SEQUENCE.length) return false;
    const tail = keys.slice(-SEQUENCE.length);
    return tail.every((key, i) => key.toLowerCase() === SEQUENCE[i].toLowerCase());
}

/**
 * Call `onEntered` when ↑ ↑ ↓ ↓ ← → ← → B A is typed while the calling
 * component is mounted. Keys typed into a field do not count: a search for
 * "ba" must not set anything off.
 */
export function useKonamiCode(onEntered: () => void) {
    let keys: string[] = [];

    function onKeydown(event: KeyboardEvent) {
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, [contenteditable="true"]')) return;

        keys = [...keys, event.key].slice(-SEQUENCE.length);
        if (endsInKonamiCode(keys)) {
            keys = [];
            onEntered();
        }
    }

    onMounted(() => window.addEventListener('keydown', onKeydown));
    onUnmounted(() => window.removeEventListener('keydown', onKeydown));
}
