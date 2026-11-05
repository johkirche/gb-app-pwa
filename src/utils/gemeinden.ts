import { GERMANY_OUTLINE } from '@/config/germanyOutline';

/** A row of the `gemeinde` collection, in the fields the list asks Directus for. */
export interface GemeindeRow {
    id: string;
    name: string;
    city?: string | null;
    /** A GeoJSON point: [longitude, latitude]. */
    coordinates?: { coordinates?: unknown } | null;
}

/** Which Gemeinde: all the account and the device need to know of one. */
export interface GemeindeRef {
    id: string;
    name: string;
}

/** A place on the map, in the units of its viewBox. */
export interface MapPoint {
    x: number;
    y: number;
}

/** A Gemeinde as the picker offers it. */
export interface GemeindeOption extends GemeindeRef {
    /** Where it meets, when the name alone does not say: „Hamburg" meets in Ahrensburg. */
    place: string | null;
    /** Its spot on the map; a row without coordinates is on the list only. */
    point: MapPoint | null;
}

const WEST = 5.6;
const EAST = 15.3;
const SOUTH = 47.2;
const NORTH = 55.2;
/** A degree of longitude at Germany's middle is this much of a degree of latitude. */
const LONGITUDE_SCALE = Math.cos((51 * Math.PI) / 180);
const UNITS_PER_DEGREE = 100;

export const MAP_WIDTH = Math.round((EAST - WEST) * LONGITUDE_SCALE * UNITS_PER_DEGREE);
export const MAP_HEIGHT = (NORTH - SOUTH) * UNITS_PER_DEGREE;

/** Where the map looks, and how close: 1 shows the whole country. */
export interface MapCamera extends MapPoint {
    zoom: number;
}

/**
 * Close enough to tell the Gemeinden around Berlin apart, which stand 10 to 20
 * pixels from each other at full view, and far enough to keep some of the country
 * in sight to find one's way by.
 */
const FOCUS_ZOOM = 2.6;

/** How fast the map follows: the distance left shrinks by two thirds in this time. */
const CAMERA_EASE_MS = 180;

function toMapPoint(longitude: number, latitude: number): MapPoint {
    return {
        x: (longitude - WEST) * LONGITUDE_SCALE * UNITS_PER_DEGREE,
        y: (NORTH - latitude) * UNITS_PER_DEGREE,
    };
}

/** Germany's outline as the `d` of an SVG path in the map's units. */
export function germanyPath(): string {
    const points = GERMANY_OUTLINE.map(([longitude, latitude]) => {
        const { x, y } = toMapPoint(longitude, latitude);
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return `M${points.join('L')}Z`;
}

function pointOf(row: GemeindeRow): MapPoint | null {
    const position = row.coordinates?.coordinates;
    if (!Array.isArray(position)) return null;
    const [longitude, latitude] = position;
    return typeof longitude === 'number' && typeof latitude === 'number'
        ? toMapPoint(longitude, latitude)
        : null;
}

/** Letters alone: „Schwedt (Oder)" and „Schwedt/Oder" are the one place. */
function letters(text: string): string {
    return text.toLowerCase().replace(/[^\p{L}]/gu, '');
}

function placeOf(row: GemeindeRow): string | null {
    const city = row.city?.trim();
    return city && !letters(row.name).includes(letters(city)) ? city : null;
}

export function toGemeinden(rows: GemeindeRow[]): GemeindeOption[] {
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        place: placeOf(row),
        point: pointOf(row),
    }));
}

/**
 * The view around a point, or of the whole country for none. Held inside the map,
 * so Riehen at its southern edge is shown low in the frame and not with half the
 * frame empty.
 */
export function cameraOn(point: MapPoint | null): MapCamera {
    if (!point) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 1 };
    const halfWidth = MAP_WIDTH / FOCUS_ZOOM / 2;
    const halfHeight = MAP_HEIGHT / FOCUS_ZOOM / 2;
    return {
        x: Math.min(Math.max(point.x, halfWidth), MAP_WIDTH - halfWidth),
        y: Math.min(Math.max(point.y, halfHeight), MAP_HEIGHT - halfHeight),
        zoom: FOCUS_ZOOM,
    };
}

export function viewBoxOf({ x, y, zoom }: MapCamera): string {
    const width = MAP_WIDTH / zoom;
    const height = MAP_HEIGHT / zoom;
    return [x - width / 2, y - height / 2, width, height].map((n) => n.toFixed(1)).join(' ');
}

/**
 * The camera a moment further on its way. Eased by the time passed rather than per
 * frame, so it moves alike on 60 and 120 Hz, and it hands back the target itself on
 * arrival, which is how the caller knows to stop.
 */
export function stepCamera(from: MapCamera, to: MapCamera, ms: number): MapCamera {
    const share = 1 - Math.exp(-ms / CAMERA_EASE_MS);
    const next = {
        x: from.x + (to.x - from.x) * share,
        y: from.y + (to.y - from.y) * share,
        // By ratio: from 1 to 2 and from 2 to 4 should look like the same move.
        zoom: from.zoom * (to.zoom / from.zoom) ** share,
    };
    const arrived =
        Math.hypot(next.x - to.x, next.y - to.y) < 0.5 && Math.abs(next.zoom - to.zoom) < 0.005;
    return arrived ? to : next;
}

/**
 * How far through the list a scroll position has come, from 0 to 1; the row that far
 * down is the chosen one. It starts once the rows pass behind the map, which is when
 * the map has stopped moving, and ends at the end of the scroll. That way the first
 * and the last row both get their turn with no blank space added to the list, and
 * the chosen row is always on the screen, sliding from under the map at the start to
 * above the way on at the end.
 *
 * @param scrollTop the scroller's position
 * @param start the position at which the rows reach the map
 * @param end the furthest the scroller goes
 */
export function listProgress(scrollTop: number, start: number, end: number): number {
    if (end <= start) return 0;
    return Math.min(Math.max((scrollTop - start) / (end - start), 0), 1);
}

/** The way back from {@link listProgress}: the position for a place in the list. */
export function scrollTopAt(progress: number, start: number, end: number): number {
    return start + progress * (end - start);
}
