import type { FunctionalComponent } from 'vue';

export { default as ActionSheet } from './ActionSheet.vue';
export { default as PanelTitle } from './PanelTitle.vue';
export { default as ResponsivePanel } from './ResponsivePanel.vue';
export { default as RowActionsTrigger } from './RowActionsTrigger.vue';
export { PANEL_CONTEXT, type PanelContext, type PanelSurface } from './context';

/** One row of an ActionSheet (drop-in replacement for an ion-action-sheet button). */
export interface ActionSheetAction {
    label: string;
    /** Lucide icon component, rendered left of the label. */
    icon?: FunctionalComponent;
    /** 'destructive' tints the row red; 'cancel' renders it as the separated cancel row. */
    role?: 'destructive' | 'cancel';
    /**
     * Name of the run this action belongs to. Consecutive actions naming the
     * same run are drawn as a block, with a hairline where the name changes —
     * so a menu can say which of its rows are one subject. Leave it off and the
     * sheet is one undivided list, as it always was.
     */
    group?: string;
    /** Runs before the sheet closes (handler-before-dismiss, as with ion-action-sheet). */
    handler?: () => void;
}
