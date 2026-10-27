/**
 * The Sector Atlas's globe, pure math: a world's plane (`WORLD_W` × `WORLD_H`, `world-map.ts`) is the planet's whole
 * surface in an equirectangular projection (x is longitude, y latitude, the middle of the plane faces the viewer at
 * rest), seen through an orthographic camera that turns the globe and zooms. A station in orbit floats at `ALTITUDE`
 * above its anchor and always faces the viewer, a flat deck drawn in its own plane units (`deckSpot`). No DOM here:
 * `sector-atlas.ts` projects its SVG and labels with `spotOnScreen`, `globe-gl.ts` paints the surface with the same
 * rotation.
 */
import { type Point, WORLD_H, WORLD_W } from "./world-map";
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
/** Radians per plane unit: the plane's width is the full circle. */
export const UNIT = (2 * Math.PI) / WORLD_W;
/** How far above the surface a station in orbit floats, in globe radii. */
export const ALTITUDE = 1.32;
/** A deck's own units on its tangent plane, relative to the surface's plane units. */
export const DECK_SCALE = 0.42;
/** Longitude and latitude (radians) of a plane point; the plane's middle is 0, 0, north (small y) is positive. */
export const lonLatOf = (p: Point) => ({ lon: (p.x - WORLD_W / 2) * UNIT, lat: (WORLD_H / 2 - p.y) * UNIT });
/** The unit vector of a plane point: x east, y north, z towards the viewer at rest. */
export function toSphere(p: Point): Vec3 {
  const { lon, lat } = lonLatOf(p),
    c = Math.cos(lat);
  return { x: c * Math.sin(lon), y: Math.sin(lat), z: c * Math.cos(lon) };
}
/** The plane point of a direction (any length). */
export function fromSphere(v: Vec3): Point {
  const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: WORLD_W / 2 + Math.atan2(v.x, v.z) / UNIT, y: WORLD_H / 2 - Math.asin(Math.max(-1, Math.min(1, v.y / r))) / UNIT };
}
/**
 * The camera: the longitude and latitude that face the viewer (radians), the globe's radius on screen (px) and the
 * globe centre's offset from the view's centre (px).
 */
export interface Camera {
  lon: number;
  lat: number;
  r: number;
  ox: number;
  oy: number;
}
/** A direction turned so the camera's `lon`, `lat` faces the viewer (+z), north up (+y). */
export function rotate(v: Vec3, { lon, lat }: Pick<Camera, "lon" | "lat">): Vec3 {
  const cl = Math.cos(lon),
    sl = Math.sin(lon),
    x1 = v.x * cl - v.z * sl,
    z1 = v.x * sl + v.z * cl,
    ca = Math.cos(lat),
    sa = Math.sin(lat);
  return { x: x1, y: v.y * ca - z1 * sa, z: v.y * sa + z1 * ca };
}
/** Where a point of the globe (or above it) lands on a `width` × `height` view, px; `z` > 0 faces the viewer. */
export function screenOf(v: Vec3, cam: Camera, width: number, height: number): Vec3 {
  const t = rotate(v, cam);
  return { x: width / 2 + cam.ox + cam.r * t.x, y: height / 2 + cam.oy - cam.r * t.y, z: t.z };
}
/** Hidden behind the globe: on its far side, and for a point in orbit, also in front of its disc. */
export const occluded = (t: Vec3) => t.z < 0 && t.x * t.x + t.y * t.y < 1;
/**
 * A place on screen: a point of the globe (or above it) plus an offset that always faces the viewer, in globe radii
 * (right, up). Surface points have none; a deck's points are its anchor plus their place on the deck.
 */
export interface Spot {
  v: Vec3;
  dx?: number;
  dy?: number;
}
export const surfaceSpot = (p: Point): Spot => ({ v: toSphere(p) });
/** A deck's anchor: high above its centre `c`. */
export function deckAnchor(c: Point): Vec3 {
  const n = toSphere(c);
  return { x: n.x * ALTITUDE, y: n.y * ALTITUDE, z: n.z * ALTITUDE };
}
/** A point `p` of a deck drawn in plane units around its centre `c`. */
export const deckSpot = (c: Point, p: Point): Spot => ({ v: deckAnchor(c), dx: (p.x - c.x) * UNIT * DECK_SCALE, dy: (c.y - p.y) * UNIT * DECK_SCALE });
/** Where a spot lands on screen, px, and whether the globe hides it. */
export function spotOnScreen(s: Spot, cam: Camera, width: number, height: number) {
  const t = rotate(s.v, cam);
  return { x: width / 2 + cam.ox + cam.r * (t.x + (s.dx ?? 0)), y: height / 2 + cam.oy - cam.r * (t.y + (s.dy ?? 0)), hidden: occluded(t), z: t.z };
}
/** The direction halfway along the great circle from `a` to `b` at `t` (lengths interpolate linearly). */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const la = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
    lb = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z),
    ua = { x: a.x / la, y: a.y / la, z: a.z / la },
    ub = { x: b.x / lb, y: b.y / lb, z: b.z / lb },
    dot = Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y + ua.z * ub.z)),
    w = Math.acos(dot),
    s = Math.sin(w),
    [ka, kb] = s < 1e-6 ? [1 - t, t] : [Math.sin((1 - t) * w) / s, Math.sin(t * w) / s],
    len = la + (lb - la) * t;
  return { x: (ua.x * ka + ub.x * kb) * len, y: (ua.y * ka + ub.y * kb) * len, z: (ua.z * ka + ub.z * kb) * len };
}
/** `steps` + 1 points along the great circle from `a` to `b`, so a long link curves with the globe. */
export const arc = (a: Vec3, b: Vec3, steps: number): Vec3[] => Array.from({ length: steps + 1 }, (_, i) => slerp(a, b, i / steps));
/** The longitude and latitude a set of directions faces on average (their normalised sum). */
export function facing(points: readonly Vec3[]) {
  const s = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }), { x: 0, y: 0, z: 0 }),
    r = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z) || 1;
  return { lon: Math.atan2(s.x, s.z), lat: Math.asin(s.y / r) };
}
/** Room kept free around a fitted camera, px: the view's bands for labels and buttons. */
export interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
/**
 * The camera that faces `lon`, `lat` and fits the visible `spots` (and with `disc` the globe, in radii) into a `width` × `height`
 * view inside `pad`, centred; the radius never exceeds `maxR`.
 */
export function fitCamera(spots: readonly Spot[], lon: number, lat: number, width: number, height: number, pad: Pad, { disc = 0, maxR = Infinity } = {}): Camera {
  let x0 = disc ? -disc : Infinity,
    x1 = disc ? disc : -Infinity,
    y0 = x0,
    y1 = x1;
  for (const s of spots) {
    const t = rotate(s.v, { lon, lat });
    if (occluded(t)) continue;
    const x = t.x + (s.dx ?? 0),
      y = -(t.y + (s.dy ?? 0));
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (!Number.isFinite(x0)) x0 = y0 = -1;
  if (!Number.isFinite(x1)) x1 = y1 = 1;
  const w = Math.max(1, width - pad.left - pad.right),
    h = Math.max(1, height - pad.top - pad.bottom),
    r = Math.min(maxR, w / Math.max(1e-3, x1 - x0), h / Math.max(1e-3, y1 - y0)),
    cx = pad.left + w / 2 - width / 2,
    cy = pad.top + h / 2 - height / 2;
  return { lon, lat, r, ox: cx - ((x0 + x1) / 2) * r, oy: cy - ((y0 + y1) / 2) * r };
}
/** Between two cameras at `t`: the shorter way round in longitude, the radius on a log scale. */
export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  let d = b.lon - a.lon;
  d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
  return {
    lon: a.lon + d * t,
    lat: a.lat + (b.lat - a.lat) * t,
    r: Math.exp(Math.log(a.r) + (Math.log(b.r) - Math.log(a.r)) * t),
    ox: a.ox + (b.ox - a.ox) * t,
    oy: a.oy + (b.oy - a.oy) * t,
  };
}
/** The camera turned by a drag of `dx`, `dy` px: the surface follows the finger; latitude stays within ±70°. */
export function dragCamera(cam: Camera, dx: number, dy: number): Camera {
  const limit = (70 * Math.PI) / 180;
  return { ...cam, lon: cam.lon - dx / cam.r, lat: Math.max(-limit, Math.min(limit, cam.lat + dy / cam.r)) };
}
/**
 * A closed outline on screen: points on the far side slide onto the globe's rim, so a territory that turns away
 * hugs the horizon; null once all of it is hidden.
 */
export function outlineOnScreen(points: readonly Vec3[], cam: Camera, width: number, height: number): Point[] | null {
  let seen = false;
  const cx = width / 2 + cam.ox,
    cy = height / 2 + cam.oy,
    out = points.map((p) => {
      const t = rotate(p, cam);
      if (t.z >= 0) {
        seen = true;
        return { x: cx + cam.r * t.x, y: cy - cam.r * t.y };
      }
      const k = 1 / (Math.sqrt(t.x * t.x + t.y * t.y) || 1);
      return { x: cx + cam.r * t.x * k, y: cy - cam.r * t.y * k };
    });
  return seen ? out : null;
}
