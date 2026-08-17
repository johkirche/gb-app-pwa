import type { FunctionalComponent } from 'vue';

export { DrawerClose, DrawerPortal, DrawerTrigger } from 'vaul-vue';

export { default as ActionSheet } from './ActionSheet.vue';
export { default as Drawer } from './Drawer.vue';
export { default as DrawerContent } from './DrawerContent.vue';
export { default as DrawerDescription } from './DrawerDescription.vue';
export { default as DrawerFooter } from './DrawerFooter.vue';
export { default as DrawerHeader } from './DrawerHeader.vue';
export { default as DrawerOverlay } from './DrawerOverlay.vue';
export { default as DrawerTitle } from './DrawerTitle.vue';

/** One row of an ActionSheet (drop-in replacement for an ion-action-sheet button). */
export interface ActionSheetAction {
    label: string;
    /** Lucide icon component, rendered left of the label. */
    icon?: FunctionalComponent;
    /** 'destructive' tints the row red; 'cancel' renders it as the separated cancel row. */
    role?: 'destructive' | 'cancel';
    /** Runs before the sheet closes (handler-before-dismiss, as with ion-action-sheet). */
    handler?: () => void;
}
