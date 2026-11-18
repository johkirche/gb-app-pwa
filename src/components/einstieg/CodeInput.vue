<template>
    <!-- Six boxes to read, one real field to type into. The field lies over the
         boxes, invisible, so a tap anywhere on them lands in it, and it carries
         `autocomplete="one-time-code"`: an iPhone offers the code from the mail
         above the keyboard. Pasting works too, with or without the space the
         mail reads it out with. -->
    <div
        class="relative mx-auto w-full max-w-[22rem]"
        :class="state === 'wrong' && 'animate-shake'"
    >
        <div class="grid grid-cols-6 gap-2" aria-hidden="true">
            <span
                v-for="i in 6"
                :key="i"
                class="flex aspect-[4/5] min-w-0 items-center justify-center rounded-lg border bg-card text-3xl font-semibold tabular-nums lining-nums transition-colors"
                :class="boxClass(i - 1)"
            >
                {{ model[i - 1] ?? '' }}
            </span>
        </div>
        <input
            :id="id"
            ref="field"
            :value="model"
            class="absolute inset-0 h-full w-full cursor-text rounded-lg opacity-0"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="12"
            aria-label="Sechsstelliger Code"
            :aria-invalid="state === 'wrong' || undefined"
            :disabled="disabled"
            @input="onInput"
            @focus="focused = true"
            @blur="focused = false"
        />
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        id?: string;
        disabled?: boolean;
        /** How the last try went, for the boxes' colour. */
        state?: 'idle' | 'wrong' | 'right';
        autofocus?: boolean;
    }>(),
    { id: 'code', disabled: false, state: 'idle', autofocus: true },
);

const emit = defineEmits<{ complete: [code: string] }>();

const model = defineModel<string>({ default: '' });
const field = ref<HTMLInputElement | null>(null);
const focused = ref(false);

function onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    // Digits only: a pasted "481 203" or "481-203" comes in whole.
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = digits;
    model.value = digits;
    if (digits.length === 6) emit('complete', digits);
}

function boxClass(index: number): string {
    if (props.state === 'wrong') return 'border-destructive';
    if (props.state === 'right') return 'border-primary';
    const current = focused.value && index === Math.min(model.value.length, 5);
    return current ? 'border-ring ring-2 ring-ring/30' : 'border-input';
}

function focus() {
    field.value?.focus();
}

onMounted(() => {
    if (props.autofocus) focus();
});

defineExpose({ focus });
</script>

<style scoped>
@keyframes shake {
    0%,
    100% {
        transform: translateX(0);
    }
    20%,
    60% {
        transform: translateX(-0.375rem);
    }
    40%,
    80% {
        transform: translateX(0.375rem);
    }
}
.animate-shake {
    animation: shake 0.4s ease-in-out;
}
@media (prefers-reduced-motion: reduce) {
    .animate-shake {
        animation: none;
    }
}
</style>
