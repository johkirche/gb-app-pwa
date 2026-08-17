<template>
    <Drawer v-model:open="open">
        <DrawerContent>
            <DrawerHeader v-if="title" class="p-3 pb-1">
                <DrawerTitle class="text-center text-base text-muted-foreground">
                    {{ title }}
                </DrawerTitle>
            </DrawerHeader>
            <VisuallyHidden v-else>
                <DrawerTitle>Aktionen</DrawerTitle>
            </VisuallyHidden>

            <div class="flex flex-col py-1">
                <button
                    v-for="(action, index) in mainActions"
                    :key="`${action.label}-${index}`"
                    type="button"
                    class="flex h-12 w-full shrink-0 items-center text-[15px] transition-colors hover:bg-muted active:bg-muted"
                    :class="action.role === 'destructive' ? 'text-destructive' : 'text-foreground'"
                    @click="select(action)"
                >
                    <!-- Full-width tappable row; icon + label sit in a centred fixed-width
                         block so icons form a column and labels share a start (mirrors the
                         app's 'action-sheet-aligned' ion-action-sheet styling). -->
                    <span class="mx-auto flex w-fit min-w-60 max-w-full items-center gap-3 px-4">
                        <component
                            :is="action.icon"
                            v-if="action.icon"
                            class="size-5 shrink-0"
                            aria-hidden="true"
                        />
                        <span class="truncate">{{ action.label }}</span>
                    </span>
                </button>
            </div>

            <div v-if="cancelActions.length" class="mt-1 border-t py-1">
                <button
                    v-for="(action, index) in cancelActions"
                    :key="`${action.label}-${index}`"
                    type="button"
                    class="flex h-12 w-full items-center justify-center text-[15px] font-medium text-foreground transition-colors hover:bg-muted active:bg-muted"
                    @click="select(action)"
                >
                    {{ action.label }}
                </button>
            </div>
        </DrawerContent>
    </Drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { VisuallyHidden } from 'reka-ui';

import Drawer from './Drawer.vue';
import DrawerContent from './DrawerContent.vue';
import DrawerHeader from './DrawerHeader.vue';
import DrawerTitle from './DrawerTitle.vue';
import type { ActionSheetAction } from './index';

interface Props {
    title?: string;
    actions: ActionSheetAction[];
}

const props = defineProps<Props>();

const open = defineModel<boolean>('open', { required: true });

const mainActions = computed(() => props.actions.filter((action) => action.role !== 'cancel'));
const cancelActions = computed(() => props.actions.filter((action) => action.role === 'cancel'));

/** Preserved app semantic (ion-action-sheet parity): run the handler first, then dismiss. */
function select(action: ActionSheetAction): void {
    action.handler?.();
    open.value = false;
}
</script>
