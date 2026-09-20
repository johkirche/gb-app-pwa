<template>
    <ResponsivePanel
        v-model:open="open"
        :anchor="anchor"
        :align="align"
        :label="title ?? 'Aktionen'"
        popover-class="w-64"
    >
        <div v-if="title" class="p-3 pb-1 lg:px-2 lg:pb-1.5 lg:pt-1">
            <PanelTitle
                class="text-center text-base font-normal text-muted-foreground lg:truncate lg:text-left lg:text-xs lg:uppercase lg:tracking-[0.12em]"
            >
                {{ title }}
            </PanelTitle>
        </div>
        <VisuallyHidden v-else>
            <PanelTitle>Aktionen</PanelTitle>
        </VisuallyHidden>

        <div class="flex flex-col py-1 lg:p-1 lg:pt-0">
            <template v-for="(group, groupIndex) in actionGroups" :key="groupIndex">
                <!-- Between runs only: the rule is what says the rows above and
                     below it are about different things. -->
                <div
                    v-if="groupIndex > 0"
                    role="separator"
                    class="my-1 h-px shrink-0 bg-border lg:-mx-1"
                ></div>

                <button
                    v-for="(action, index) in group"
                    :key="`${action.label}-${index}`"
                    type="button"
                    class="flex h-12 w-full shrink-0 items-center text-[0.9375rem] transition-colors hover:bg-muted active:bg-muted lg:h-9 lg:rounded-md lg:text-sm"
                    :class="action.role === 'destructive' ? 'text-destructive' : 'text-foreground'"
                    @click="select(action)"
                >
                    <!-- Full-width tappable row; on phones the icon + label sit in a
                         centred fixed-width block so icons form a column and labels
                         share a start (mirrors the app's 'action-sheet-aligned'
                         ion-action-sheet styling). In the desktop popover the same
                         row reads as an ordinary left-aligned menu item. -->
                    <span
                        class="mx-auto flex w-fit min-w-60 max-w-full items-center gap-3 px-4 lg:mx-0 lg:w-full lg:min-w-0 lg:gap-2.5 lg:px-2"
                    >
                        <component
                            :is="action.icon"
                            v-if="action.icon"
                            class="size-5 shrink-0 lg:size-4"
                            aria-hidden="true"
                        />
                        <span class="truncate">{{ action.label }}</span>
                    </span>
                </button>
            </template>
        </div>

        <!-- A popover dismisses by clicking away or pressing Escape, so the
             separated cancel row is a phone-only affordance. -->
        <div v-if="cancelActions.length" class="mt-1 border-t py-1 lg:hidden">
            <button
                v-for="(action, index) in cancelActions"
                :key="`${action.label}-${index}`"
                type="button"
                class="flex h-12 w-full items-center justify-center text-[0.9375rem] font-medium text-foreground transition-colors hover:bg-muted active:bg-muted"
                @click="select(action)"
            >
                {{ action.label }}
            </button>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { type PopoverContentProps, VisuallyHidden } from 'reka-ui';

import type { PanelAnchor } from '@/lib/anchor';

import PanelTitle from './PanelTitle.vue';
import ResponsivePanel from './ResponsivePanel.vue';
import type { ActionSheetAction } from './index';

interface Props {
    title?: string;
    actions: ActionSheetAction[];
    /** What the desktop popover opens against — the row or control pressed. */
    anchor?: PanelAnchor;
    align?: PopoverContentProps['align'];
}

const props = withDefaults(defineProps<Props>(), {
    title: undefined,
    anchor: null,
    align: 'start',
});

const open = defineModel<boolean>('open', { required: true });

const mainActions = computed(() => props.actions.filter((action) => action.role !== 'cancel'));
const cancelActions = computed(() => props.actions.filter((action) => action.role === 'cancel'));

/**
 * The rows split into runs of a shared {@link ActionSheetAction.group}. Actions
 * that name no group fall into one run with their neighbours, so a sheet that
 * never mentions groups renders exactly as it did before.
 */
const actionGroups = computed(() => {
    const groups: ActionSheetAction[][] = [];

    for (const action of mainActions.value) {
        const current = groups.at(-1);

        if (current && current[0].group === action.group) current.push(action);
        else groups.push([action]);
    }

    return groups;
});

/** Preserved app semantic (ion-action-sheet parity): run the handler first, then dismiss. */
function select(action: ActionSheetAction): void {
    action.handler?.();
    open.value = false;
}
</script>
