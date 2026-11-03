/**
 * Whether a download here could come out of someone's data plan.
 *
 * Only a phone or a tablet carries a SIM, and „phone or tablet" is read off
 * the pointer, as preferShareSheet does: a finger is a handheld, a mouse is a
 * desk. At a desk there is no plan to ask about.
 *
 * Where the browser can name the connection — Chrome on Android, and nowhere
 * else; on iOS no browser has navigator.connection at all — WLAN and Ethernet
 * settle it. Where it cannot, a handheld is taken to be on mobile data: asking
 * once too often costs a tap, not asking costs the reader's plan.
 */
export function mayUseMobileData(nav: Navigator = navigator, win: Window = window): boolean {
    if (!(win.matchMedia?.('(pointer: coarse)').matches ?? false)) return false;
    const type = (nav as Navigator & { connection?: { type?: string } }).connection?.type;
    return type !== 'wifi' && type !== 'ethernet';
}
