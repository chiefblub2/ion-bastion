import { halo } from "../../material";
import { disc, oval, shade, type Ink } from "../../shapes";
import type { TurretContext } from "../kit";
import { SQUASH, X, Y, block, drum, onGround } from "../tilt";
import { lampInk, lampLight } from "../tilt-parts";
import { DEEP, METAL, STEEL, STEEL_TOP, ball, contact, flatRing, ngon, post, slab } from "./kit-support-b";
import type { TiltedConcept as Concept } from "../tilted";

// Nexus: the Relay Lattice. A hexagonal plinth with the lattice engraved in its deck; three tapered pylons with crystal
// tips stand round a short central relay (base, still: Nexus never aims). Beams of light link the tips into a network
// and a pulse jumps from tip to tip (`above`); the relay's lamp and the crystals' light are live too.
const DROP = 6,
  H = 4.5,
  /** Pylons: radius from the centre, height of the crystal tips; the central relay's top. */
  RING = 13,
  TIP = H + 12,
  RELAY = H + 6;
/** The pylons' angles: one at the back, two in front. */
const PYLONS = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
const PLINTH = ngon(6, 21),
  PLINTH_IN = ngon(6, 19.6);

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 21);
  slab(g, x, y0, PLINTH, PLINTH_IN, 0, H, STEEL, STEEL_TOP, METAL, 1);
  // The engraved lattice: a hexagon and its spokes on the deck.
  onGround(g, x, y0, H + 1, () => {
    g.lineStyle(0.9, shade(c, -0.45), 0.85);
    for (let i = 0; i < 6; i++) {
      const a0 = (i * Math.PI) / 3,
        a1 = a0 + Math.PI / 3;
      g.lineBetween(Math.cos(a0) * 15, Math.sin(a0) * 15, Math.cos(a1) * 15, Math.sin(a1) * 15);
      g.lineBetween(Math.cos(a0) * 6, Math.sin(a0) * 6, Math.cos(a0) * 15, Math.sin(a0) * 15);
    }
    oval(g, 0, 0, 6, 6, DEEP);
  });
  if (level >= 4) flatRing(g, x, y0, H + 1, 17.3, 0.9, color, 0.95);
  // The relay and the pylons, back to front: the back pylon, the relay, then the two in front.
  pylon(g, x, y0, PYLONS[0], level, c, color);
  drum(g, x, y0, 4.6, H + 1, RELAY, STEEL, STEEL_TOP, 12);
  drum(g, x, y0, 3, RELAY, RELAY + 1.6, shade(c, -0.45), shade(c, -0.15), 10);
  if (level >= 2) lampInk(g, X(x, 0), Y(y0, 0, RELAY + 2.2), color);
  for (const a of PYLONS.slice(1)) pylon(g, x, y0, a, level, c, color);
}
/** A tapered square pylon at angle a with a crystal on its tip; level 3 a collar, level 4+ a band in the trim colour. */
function pylon(g: Ink, x: number, y0: number, a: number, level: number, c: number, color: number) {
  const u = Math.cos(a) * RING,
    v = Math.sin(a) * RING,
    foot = Float64Array.from([-2.6, -2.6, 2.6, -2.6, 2.6, 2.6, -2.6, 2.6], (p, i) => p + (i % 2 ? v : u)),
    top = Float64Array.from([-1.5, -1.5, 1.5, -1.5, 1.5, 1.5, -1.5, 1.5], (p, i) => p + (i % 2 ? v : u));
  block(g, x, y0, foot, top, 4, H, TIP - 2, 0, STEEL, STEEL_TOP, METAL);
  if (level >= 3) post(g, x, y0, u, v, 2.4, H + 4, H + 5.4, DEEP, METAL);
  if (level >= 4) post(g, x, y0, u, v, 2.1, TIP - 5, TIP - 4, level >= 4 ? color : shade(c, -0.3));
  ball(g, X(x, u), Y(y0, v, TIP), 2.2, c);
}
const tipOf = (x: number, y0: number, a: number) => [X(x, Math.cos(a) * RING), Y(y0, Math.sin(a) * RING, TIP)] as const;

/** Nothing under a turret: Nexus is all base and light. */
function below() {}
function turret() {}

/**
 * The network: beams between the crystal tips (one link at level 1, the whole triangle from level 2, spokes to the
 * relay from level 3), a pulse jumping from tip to tip, the crystals' and the relay lamp's light.
 */
function above({ g, glow, x, y, tower, clock, level, energy, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    tips = PYLONS.map((a) => tipOf(x, y0, a)),
    relay = [X(x, 0), Y(y0, 0, RELAY + 1.6)] as const,
    links: [readonly [number, number], readonly [number, number]][] = [[tips[1], tips[2]]];
  if (level >= 2) links.push([tips[0], tips[1]], [tips[2], tips[0]]);
  if (level >= 3) for (const t of tips) links.push([t, relay]);
  const flicker = 0.75 + 0.25 * Math.sin(clock * 7 + tower.id);
  for (const [p, q] of links) {
    glow.lineStyle(2.2, c, (0.14 + energy) * flicker);
    glow.lineBetween(p[0], p[1], q[0], q[1]);
    g.lineStyle(0.6, shade(c, 0.5), 0.55 * flicker);
    g.lineBetween(p[0], p[1], q[0], q[1]);
  }
  // The pulse runs along the triangle's links, one link a third of a second.
  const k = (clock * 3 + tower.id) % 3,
    n = level >= 2 ? Math.floor(k) : 0,
    f = level >= 2 ? k - n : (clock * 1.5 + tower.id) % 1,
    [p, q] = level >= 2 ? [tips[n], tips[(n + 1) % 3]] : [tips[1], tips[2]],
    px = p[0] + (q[0] - p[0]) * f,
    py = p[1] + (q[1] - p[1]) * f;
  disc(g, px, py, 1.1, 0xffffff, 0.9);
  halo(glow, px, py, 5, c, 0.35);
  for (const t of tips) disc(glow, t[0], t[1], 4, c, 0.2 + energy);
  if (level >= 2) lampLight(glow, X(x, 0), Y(y0, 0, RELAY + 2.2), color);
}

export const concept: Concept = {
  tower: "nexus",
  name: "Relay Lattice",
  idea: "Three tapered pylons with crystal tips round a short relay on a hex plinth: beams link the tips into a network (more links per level) and a pulse jumps from tip to tip.",
  tilt: { drop: DROP, squash: SQUASH, height: TIP, deck: H + 1 },
  base,
  below,
  turret,
  above,
};
