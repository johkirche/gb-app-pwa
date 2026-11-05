/** Whether the reader has asked the device for less movement on the screen. */
export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
