import { halo } from "../render/material";
import { disc, oval, shade, type Ink } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { SQUASH, X, Y, drum, onGround } from "../render/tower-art/tilt";
import { lampInk, lampLight } from "../render/tower-art/tilt-parts";
import { DEEP, METAL, STEEL, STEEL_TOP, ball, contact, flatRing, ngon, post, slab } from "./kit-support-b";
import type { Concept } from "./types";

// Nexus: the Lattice Node. A hexagonal plinth with a socket at every corner and the lattice engraved between them
// (base); a pillar carrying the core dome (turret, still); six satellites turning round the core on the lattice, a
// pulse running from one to the next (the ones behind the core in `below`, the ones in front in `above`).
const DROP = 6,
  H = 4.5,
  PILLAR = H + 7,
  CORE = PILLAR + 4,
  ORBIT = 12.5,
  SAT_H = PILLAR + 1;
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
  // Corner sockets: back ones first; their caps light one pair per level (the light is live).
  const corners = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3).sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of corners) post(g, x, y0, Math.cos(a) * 17.5, Math.sin(a) * 17.5, 2.2, H, H + (level >= 3 ? 3.4 : 2.4), STEEL, shade(c, -0.4));
  if (level >= 2) lampInk(g, X(x, 0), Y(y0, 20.6, H * 0.5), color);
}

/** The pillar and the core dome. */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  drum(g, x, y0, 4.2, H + 1, PILLAR, STEEL, STEEL_TOP, 10);
  drum(g, x, y0, 6, PILLAR, CORE, shade(c, -0.45), shade(c, -0.2), 14);
  if (level >= 4) flatRing(g, x, y0, CORE, 5.2, 0.8, color, 0.95);
  // The dome: lit cap with a glint toward the light.
  const [dx, dy] = [X(x, 0), Y(y0, 0, CORE + 1.6)];
  oval(g, dx, dy, 4.6, 3.6, shade(c, -0.1));
  oval(g, dx - 1.2, dy - 1, 2.2, 1.5, shade(c, 0.45));
  disc(g, dx - 1.6, dy - 1.3, 0.6, 0xffffff, 0.8);
}

/** Satellite i's angle, ground point and whether it is lit (one pair per level). */
function satellites({ tower, clock, level }: TurretContext) {
  const spin = clock * 0.25 + tower.id;
  return Array.from({ length: 6 }, (_, i) => {
    const a = spin + (i * Math.PI) / 3;
    return { i, a, u: Math.cos(a) * ORBIT, v: Math.sin(a) * ORBIT, on: i < level * 2 };
  });
}
function satellite(g: Ink, glow: Ink, ctx: TurretContext, s: ReturnType<typeof satellites>[number], pulse: number) {
  const { x, y, definition } = ctx,
    y0 = y + DROP,
    c = definition.color,
    sx = X(x, s.u),
    sy = Y(y0, s.v, SAT_H);
  // Its strut to the core: ink, so the core covers the inner end of the back ones.
  g.lineStyle(1, shade(c, -0.3), 0.8);
  g.lineBetween(X(x, 0), Y(y0, 0, SAT_H), sx, sy);
  ball(g, sx, sy, 2.3, s.on ? c : shade(c, -0.55));
  if (s.on && s.i === pulse) {
    disc(g, sx, sy, 1, 0xffffff, 0.9);
    halo(glow, sx, sy, 6, c, 0.4);
  }
}
const pulseOf = ({ clock, tower, level }: TurretContext) => Math.floor((clock * 3 + tower.id) % (level * 2 || 1));

/** Satellites behind the core. */
function below(ctx: TurretContext) {
  for (const s of satellites(ctx)) if (Math.sin(s.a) < 0) satellite(ctx.g, ctx.glow, ctx, s, pulseOf(ctx));
}

/** Satellites in front of the core, the lattice's light and the core's halo. */
function above(ctx: TurretContext) {
  const { g, glow, x, y, level, energy, color, definition } = ctx,
    y0 = y + DROP,
    c = definition.color,
    sats = satellites(ctx);
  for (const s of sats.filter((q) => Math.sin(q.a) >= 0).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))) satellite(g, glow, ctx, s, pulseOf(ctx));
  // The orbit ring in light, joining the lit satellites.
  onGround(glow, x, y0, SAT_H, () => {
    glow.lineStyle(1.6, c, 0.12 + energy);
    for (let i = 0; i < 6; i++) {
      const p = sats[i],
        q = sats[(i + 1) % 6];
      if (p.on && q.on) glow.lineBetween(p.u, p.v, q.u, q.v);
    }
  });
  halo(glow, X(x, 0), Y(y0, 0, CORE + 1.5), 10, c, 0.14 + energy);
  if (level >= 2) lampLight(glow, X(x, 0), Y(y0, 20.6, H * 0.5), color);
}

export const concept: Concept = {
  tower: "nexus",
  name: "Lattice Node",
  idea: "Hex plinth with corner sockets and an engraved lattice; a core dome on a pillar, six satellites orbit it, a pulse hops between the lit ones.",
  tilt: { drop: DROP, squash: SQUASH, height: CORE, deck: H + 1 },
  base,
  below,
  turret,
  above,
};
