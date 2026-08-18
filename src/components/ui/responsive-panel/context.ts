import type { ComputedRef, InjectionKey } from 'vue';

/** The two forms a responsive panel takes, split at the `lg` breakpoint. */
export type PanelSurface = 'popover' | 'drawer';

export interface PanelContext {
    surface: ComputedRef<PanelSurface>;
}

export const PANEL_CONTEXT: InjectionKey<PanelContext> = Symbol('ResponsivePanel');
