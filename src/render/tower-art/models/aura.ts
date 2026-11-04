import { halo } from "../../material";
import { disc, ring, shade } from "../../shapes";
import { trackOf } from "../../../core/upgrades";
import { MOTIFS } from "../motifs";
import { rod } from "../tilt-frame";
import { SQUASH, onDeck, onGround } from "../tilt";
import { STEEL, at, contact, drumAt, ngon, slab } from "./kit-support-a";
import type { TiltedConcept as Concept } from "../tilted";
import type { TurretContext } from "../kit";

/** Aura: a round dais with three emitter masts; a ring floats over them in the track's colour, its motif on the dais. */
const DROP = 5,
  LOW = 3,
  DAIS = 6,
  MAST = 19,
  RING = 25;
const LOWER = ngon(12, 20, Math.PI / 12),
  UPPER = ngon(12, 15, Math.PI / 12);
/** Mast angles, the back one first. */
const MASTS = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
const CYAN = 0x78dfff;

/** The track's (levels 2–4) or the path's (5–7) motif and colour, undefined while undecided. */
function choice({ tower, definition: d, path }: TurretContext) {
  const track = trackOf(tower, d);
  if (path) return { motif: d.visual.paths?.[path]?.motif, tier: 0 };
  if (track) return { motif: d.visual.tracks?.[track]?.motif, tier: 0 };
  return undefined;
}

export const concept: Concept = {
  tower: "aura",
  name: "Emitter Dais",
  idea: "A round two-step dais with three emitter masts; a ring floats over them in the track's colour, the track's motif turns on the dais.",
  tilt: { drop: DROP, squash: SQUASH, height: RING, deck: DAIS },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0);
    contact(g, x, y0, 20, 16);
    slab(g, x, y0, LOWER, 0, LOW, 0, STEEL.side, STEEL.top);
    slab(g, x, y0, UPPER, LOW, DAIS, 1.2, shade(CYAN, -0.68), shade(CYAN, -0.5), shade(CYAN, 0));
    // A ring of studs round the lower step, lit from level 3.
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      if (Math.sin(t) < -0.2) continue;
      disc(g, ...P(Math.cos(t) * 17.6, Math.sin(t) * 17.6, LOW + 0.3), 0.8, level >= 3 ? shade(color, -0.2) : STEEL.deep);
    }
    // Emitter masts: a slim pylon with a cap in the chosen colour (cyan while undecided), taller from level 5.
    const top = MAST + (level >= 5 ? 3 : 0);
    for (const a of MASTS) {
      const u = Math.cos(a) * 12,
        v = Math.sin(a) * 12;
      drumAt(g, x, y0, u, v, 2, DAIS - 1, top, STEEL.side, STEEL.top, 8);
      drumAt(g, x, y0, u, v, 2.6, top, top + 2, shade(color, -0.3), shade(color, 0.15), 8);
      if (level >= 2) rod(g, x, y0, u, v, DAIS + 2, u * 0.7, v * 0.7, DAIS + 0.2, 1, STEEL.metal);
    }
  },
  below: (ctx) => {
    const { g, glow, x, y, tower, clock, level, definition: d } = ctx,
      y0 = y + DROP,
      c = choice(ctx);
    // The chosen track's motif turns on the dais (a path's motif the sheet lays on the deck itself); undecided, one
    // dimmed dot per track colour hints at the choice.
    if (ctx.path) return;
    if (c?.motif) {
      const tier = Math.min(3, Math.max(1, ctx.path ? level - 4 : level - 1));
      onDeck([g, glow], x, y0, DAIS, () => MOTIFS[c.motif!]({ ...ctx, x: 0, y: 0 }, tier, clock + tower.id, 0.05 + 0.04 * tier), 0.62);
    } else
      onGround(g, x, y0, DAIS, () => {
        Object.values(d.visual.tracks ?? {}).forEach((option, i, all) => {
          const t = clock * 0.4 + (i * Math.PI * 2) / all.length;
          disc(g, Math.cos(t) * 8, Math.sin(t) * 8, 2, option.color, 0.6);
        });
      });
  },
  turret: () => {},
  above: ({ g, glow, x, y, clock, level, color, tower }) => {
    const y0 = y + DROP,
      P = at(x, y0),
      bob = Math.sin(clock * 1.8 + tower.id) * 1,
      top = MAST + (level >= 5 ? 3 : 0) + 2,
      [cx, cy] = P(0, 0, RING + bob + (level >= 5 ? 2 : 0));
    // Beams from the mast caps into the ring.
    for (const a of MASTS) {
      const [mx, my] = P(Math.cos(a) * 12, Math.sin(a) * 12, top);
      glow.lineStyle(1.4, color, 0.25);
      glow.lineBetween(mx, my, cx, cy);
      disc(glow, mx, my, 2.4, color, 0.3);
    }
    // The floating ring, seen at the board's squash, and a core in it; from level 5 a second, wider ring.
    onGround(g, cx, cy, 0, () => {
      ring(g, 0, 0, 8, 2.6, 0x081217, 0.9);
      ring(g, 0, 0, 8, 1.6, shade(color, -0.1));
      if (level >= 5) ring(g, 0, 0, 11.5, 1, shade(color, 0.2), 0.8);
    });
    onGround(glow, cx, cy, 0, () => ring(glow, 0, 0, 8, 3, color, 0.3));
    disc(g, cx, cy, 2.2, shade(color, 0.4));
    halo(glow, cx, cy, 9, color, 0.18 + 0.06 * Math.sin(clock * 3));
  },
};
