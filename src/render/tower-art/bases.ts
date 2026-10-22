import type { TurretStyle } from "../../core/types";
import { DARK, OUTLINE, PLATE, SHADOW, facing, led, litBar, plate, rivets, sunken } from "../material";
import { arcBand, chamferRect, disc, oval, polygon, ring, shade } from "../shapes";
import { type Drawing, TAU, PTS, put, at, quad, tick, pip, facets, inlay, base, trapFrame, hexLine, CORNERS } from "./kit";
/** Base plates by `visual.turret`: the raised plate with its deck, studs and trim. */
export const BASES: Record<TurretStyle, Drawing> = {
  barrel: (ctx) => {
    base(ctx, { n: 6, rot: Math.PI / 6 }, 23, 19);
    rivets(ctx.g, ctx.x, ctx.y, 21, 3, Math.PI / 6, shade(ctx.definition.color, -0.45));
  },
  heavy: (ctx) => {
    const { g, x, y } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 18);
    // Seams between the armour panels.
    g.fillStyle(OUTLINE, 0.75);
    for (let i = 0; i < 8; i++) tick(g, x, y, (i * Math.PI) / 4, 18.6, 23, 1.2);
  },
  twin: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    // Outrigger legs under the plate.
    g.fillStyle(shade(d.color, -0.6));
    for (let i = 0; i < 4; i++) tick(g, x, y, Math.PI / 4 + (i * Math.PI) / 2, 12, 20, 3.2);
    base(ctx, { n: 4 }, 23, 17);
  },
  coil: (ctx) => {
    const { g, glow, x, y, definition: d, charge } = ctx,
      bells = [0, 1, 2, 3, 4, 5].map((i) => at(x, y, (i * Math.PI) / 3, 19.3));
    base(ctx, "disc", 21, 17);
    // Insulator bells on the rim; their glass glows with the stored charge.
    g.fillStyle(shade(d.color, -0.55));
    for (const p of bells) pip(g, p.x, p.y, 2.7);
    g.fillStyle(shade(d.color, -0.05));
    for (const p of bells) pip(g, p.x - 0.5, p.y - 0.5, 1.4);
    glow.fillStyle(d.color, 0.1 + 0.2 * charge);
    for (const p of bells) pip(glow, p.x, p.y, 2.4);
  },
  crystal: (ctx) => {
    const { g, x, y, level, color } = ctx;
    // Six facets, each shaded by where its edge faces.
    polygon(g, x, y, 24.2, 6, OUTLINE, 0, 0.85);
    facets(g, x, y, 23, 6, 0, PLATE, 0.32);
    sunken(g, x, y, { n: 6 }, 18, DARK);
    if (level >= 4) inlay(g, x, y, { n: 6 }, 21.4, shade(color, -0.35));
  },
  rail: (ctx) => {
    base(ctx, { n: 6 }, 23, 19);
    rivets(ctx.g, ctx.x, ctx.y, 21, 2, 0, shade(ctx.definition.color, -0.55));
  },
  flame: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, energy } = ctx,
      heat = 0.75 + 0.25 * Math.sin(clock * 13 + t.id * 1.7),
      vents = [0, 1, 2, 3].map((i) => Math.PI / 4 + (i * Math.PI) / 2);
    base(ctx, { n: 8, rot: Math.PI / 8 }, 23, 19);
    // Heat vents with the furnace glowing behind them.
    g.fillStyle(OUTLINE);
    for (const a of vents) tick(g, x, y, a, 16.5, 21, 2.8);
    g.fillStyle(shade(d.color, -0.25), 0.45 + 0.35 * heat);
    for (const a of vents) tick(g, x, y, a, 17.2, 20.3, 1.2);
    glow.fillStyle(d.color, 0.1 + 0.1 * heat + energy);
    for (const a of vents) tick(glow, x, y, a, 16.8, 20.7, 2.2);
  },
  emitter: (ctx) => {
    const { g, x, y, definition: d } = ctx,
      nodes = [0, 1, 2].map((i) => at(x, y, -Math.PI / 2 + (i * TAU) / 3, 20));
    base(ctx, "disc", 22, 18);
    g.fillStyle(shade(d.color, -0.55));
    for (const p of nodes) pip(g, p.x, p.y, 3);
    g.fillStyle(d.color, 0.9);
    for (const p of nodes) pip(g, p.x - 0.3, p.y - 0.3, 1.4);
  },
  vat: (ctx) => {
    base(ctx, { cut: 0.3 }, 21, 17);
    rivets(ctx.g, ctx.x, ctx.y, 22.4, 4, Math.PI / 4, shade(ctx.definition.color, -0.55));
  },
  prism: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 12 }, 23, 19);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * TAU) / 3,
        p = at(x, y, a, 21);
      polygon(g, p.x, p.y, 2.6, 3, shade(d.color, -0.35 + 0.2 * facing(a)), a);
    }
  },
  refinery: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.12 }, 22, 18, { cut: 0.35 });
    // Hazard plates in the corners.
    for (const [sx, sy] of CORNERS) {
      put(0, x + sx * 19.4, y + sy * 11.8);
      put(1, x + sx * 19.4, y + sy * 17.4);
      put(2, x + sx * 17.4, y + sy * 19.4);
      put(3, x + sx * 11.8, y + sy * 19.4);
      g.fillStyle(shade(d.color, -0.3 + 0.16 * facing(Math.atan2(sy, sx))));
      g.fillPoints(PTS, true, false, 4);
    }
  },
  // Round plate with bearing ticks.
  radar: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    g.fillStyle(shade(d.color, -0.35));
    for (let i = 0; i < 8; i++) tick(g, x, y, (i * Math.PI) / 4, 18.8, 21.5, 1.5);
  },
  // Octagon with four lens mounts.
  lens: (ctx) => {
    base(ctx, { n: 8 }, 23, 19);
    rivets(ctx.g, ctx.x, ctx.y, 21, 4, 0, shade(ctx.definition.color, -0.5));
  },
  // Round plate with an orbit track.
  gravity: (ctx) => {
    base(ctx, "disc", 22, 18);
    ring(ctx.g, ctx.x, ctx.y, 20, 1, shade(ctx.definition.color, -0.4), 0.9);
  },
  // Heavy square emplacement: a notched turntable and stacked sandbags in the corners.
  mortar: (ctx) => {
    const { g, x, y, definition: d } = ctx,
      c = d.color;
    base(ctx, { cut: 0.32 }, 22, 18, "disc");
    g.fillStyle(OUTLINE, 0.8);
    for (let i = 0; i < 8; i++) tick(g, x, y, (i * Math.PI) / 4 + Math.PI / 8, 14.8, 17.2, 1);
    for (const [sx, sy] of CORNERS) {
      const rot = (-sx * sy * Math.PI) / 4;
      oval(g, x + sx * 17.6 + 0.6, y + sy * 17.6 + 1, 5.4, 3.3, shade(c, -0.6), 1, rot);
      oval(g, x + sx * 17.2 - 0.4, y + sy * 17.2 - 0.6, 4.4, 2.5, shade(c, -0.2), 1, rot);
    }
  },
  mine: (ctx) => trapFrame(ctx, 15),
  spikes: (ctx) => trapFrame(ctx, 19),
  tar: ({ g, x, y, definition: d, level }) => {
    oval(g, x, y, 20, 17, shade(d.color, -0.6), 0.9);
    if (level >= 5) ring(g, x, y, 20.5, 0.8, d.color, 0.5);
  },
  snare: (ctx) => trapFrame(ctx, 18),
  grill: (ctx) => trapFrame(ctx, 19),
  spring: (ctx) => trapFrame(ctx, 16),
  limpet: (ctx) => trapFrame(ctx, 14),
  // A dug shaft in a rim of stones: its inner wall is shaded on the upper left and lit on the lower right.
  pit: ({ g, x, y, definition: d, level }) => {
    const c = d.color;
    disc(g, x, y, 19.5, shade(c, -0.5), 0.9);
    if (level >= 5) ring(g, x, y, 20.5, 0.8, c, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4,
        p = at(x, y, a, 17);
      polygon(g, p.x, p.y, 3.7, 5, shade(c, -0.12 + 0.3 * facing(a)), a);
    }
    disc(g, x, y, 15, shade(c, -0.72));
    arcBand(g, x, y, 13.6, 2.8, Math.PI / 4 - 1.3, Math.PI / 4 + 1.3, shade(c, -0.3));
    disc(g, x - 1, y - 1, 11.6, 0x020506);
  },
  // Two posts on the path edge.
  tripwire: ({ g, x, y, definition: d, level }) => {
    if (level >= 5) ring(g, x, y, 20.5, 0.8, d.color, 0.5);
    g.fillStyle(SHADOW, 0.4);
    for (const sx of [-1, 1]) g.fillRect(x + sx * 16 - 2, y - 2.5, 6, 8);
    g.fillStyle(shade(d.color, -0.55));
    for (const sx of [-1, 1]) g.fillRect(x + sx * 16 - 3, y - 4, 6, 8);
    g.fillStyle(shade(d.color, -0.3));
    for (const sx of [-1, 1]) g.fillRect(x + sx * 16 - 3, y - 4, 6, 1.4);
  },
  // Cracked stone slab.
  hammer: (ctx) => {
    const { g, x, y } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 20);
    // Each crack is a dark split with a lit lip along its lower-right edge.
    for (const lip of [0.7, 0]) {
      g.lineStyle(lip ? 0.9 : 1.5, lip ? shade(DARK, 0.4) : OUTLINE, lip ? 0.85 : 0.9);
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        g.moveTo(x + Math.cos(a) * 12.5 + lip, y + Math.sin(a) * 12.5 + lip);
        g.lineTo(x + Math.cos(a + 0.16) * 16.2 + lip, y + Math.sin(a + 0.16) * 16.2 + lip);
        g.lineTo(x + Math.cos(a + 0.05) * 19.8 + lip, y + Math.sin(a + 0.05) * 19.8 + lip);
      }
      g.strokePath();
    }
  },
  // Narrow diamond plate.
  blade: (ctx) => {
    base(ctx, { n: 4 }, 25, 20);
    rivets(ctx.g, ctx.x, ctx.y, 21.5, 4, 0, shade(ctx.definition.color, -0.45));
  },
  // Round plate with vents for the fragments; they glow after a shot.
  scatter: (ctx) => {
    const { g, glow, x, y, definition: d, kick } = ctx,
      vents = [0, 1, 2, 3, 4].map((i) => at(x, y, -Math.PI / 2 + (i * TAU) / 5, 20));
    base(ctx, "disc", 22, 18);
    g.fillStyle(OUTLINE);
    for (const p of vents) pip(g, p.x, p.y, 1.8);
    if (kick > 0) {
      glow.fillStyle(d.color, 0.3 * kick);
      for (const p of vents) pip(glow, p.x, p.y, 3);
    }
  },
  // Triangle mast base.
  antenna: (ctx) => {
    base(ctx, { n: 3, rot: -Math.PI / 2 }, 25, 20);
    rivets(ctx.g, ctx.x, ctx.y, 19, 3, -Math.PI / 2, shade(ctx.definition.color, -0.4));
  },
  // Chamfered square emplacement with a stud in each corner.
  battery: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.3 }, 23, 18, "disc");
    g.fillStyle(shade(d.color, -0.55));
    for (const [sx, sy] of CORNERS) pip(g, x + sx * 16.5, y + sy * 16.5, 1.8);
    g.fillStyle(shade(PLATE, 0.45), 0.8);
    for (const [sx, sy] of CORNERS) pip(g, x + sx * 16.5 - 0.5, y + sy * 16.5 - 0.5, 0.7);
  },
  // Hexagonal bench with three spare vials in a rack, their reagent glowing as the next dart brews.
  flask: (ctx) => {
    const { g, glow, x, y, definition: d, charge } = ctx,
      spares = [0, 1, 2].map((i) => at(x, y, Math.PI / 6 + (i * TAU) / 3, 19));
    base(ctx, { n: 6 }, 23, 18);
    g.fillStyle(OUTLINE);
    for (const p of spares) pip(g, p.x, p.y, 3);
    g.fillStyle(shade(d.color, -0.15));
    for (const p of spares) pip(g, p.x - 0.3, p.y - 0.3, 1.9);
    glow.fillStyle(d.color, 0.08 + 0.14 * charge);
    for (const p of spares) pip(glow, p.x, p.y, 2.6);
  },
  // Octagonal casemate with four coolant vents; the vents glow from the plasma reservoir below.
  caster: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx,
      vents = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2);
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 19, "disc");
    g.fillStyle(OUTLINE);
    for (const a of vents) tick(g, x, y, a, 18.6, 22.4, 3.4);
    g.fillStyle(shade(d.color, -0.2));
    for (const a of vents) tick(g, x, y, a, 19.2, 21.8, 1.4);
    glow.fillStyle(d.color, 0.12 + energy);
    for (const a of vents) tick(glow, x, y, a, 18.8, 22.2, 2.6);
  },
  // Square rack with crossed straps.
  launcher: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 4, rot: Math.PI / 4 }, 25, 20);
    g.fillStyle(shade(d.color, -0.45), 0.8);
    for (const a of [Math.PI / 4, -Math.PI / 4]) quad(g, x, y, Math.cos(a), Math.sin(a), -17, 17, -0.5, 0.5, -0.5, 0.5);
  },
  // Round plate with a coin rim; the bounty radius shimmers faintly.
  beacon: (ctx) => {
    const { g, x, y, definition: d, clock } = ctx;
    base(ctx, "disc", 22, 18);
    ring(g, x, y, 20, 2, shade(d.color, -0.3), 0.6 + 0.3 * Math.sin(clock * 2));
  },
  // Rounded dock with clamps, lit on top.
  dock: (ctx) => {
    const { g, x, y, definition: d } = ctx,
      clamps = [0, 1, 2, 3].map((i) => at(x, y, (i * Math.PI) / 2, 20));
    base(ctx, { cut: 0.42 }, 22, 18);
    g.fillStyle(shade(d.color, -0.5));
    for (const p of clamps) g.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    g.fillStyle(shade(d.color, -0.15));
    for (const p of clamps) g.fillRect(p.x - 2.5, p.y - 2.5, 5, 1.2);
  },
  // Hexagon with a scale of bearing ticks.
  tracker: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 6, rot: Math.PI / 6 }, 23, 19);
    g.fillStyle(shade(d.color, -0.35));
    for (let i = 0; i < 12; i++) tick(g, x, y, (i * Math.PI) / 6, 16, i % 3 ? 17.5 : 19, 1.5);
  },
  aura: (ctx) => {
    const { g, x, y, color: c, path, level, clock } = ctx;
    base(ctx, "disc", 22, 18);
    // Dim until a path is chosen; the speed path spins faster with every tier.
    const spin = path === "speed" ? 0.3 * (1 + level) : 0.3;
    for (let i = 0; i < 12; i++) {
      const a = clock * spin + (i * Math.PI) / 6;
      arcBand(g, x, y, 24, 2, a, a + 0.3, c, path ? 0.45 : 0.2);
    }
    // Three pylons, lit one per purchase.
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, -Math.PI / 6 + (i * TAU) / 3, 20);
      led(ctx, p.x, p.y, c, i < level ? 1 : 0);
    }
  },
  // Square uplink pad on a round deck: a targeting scale round the deck and four corner pylons whose lamps blink in turn.
  uplink: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock } = ctx,
      lit = Math.floor(clock * 2 + t.id) % 4;
    base(ctx, { cut: 0.22 }, 23, 18, "disc");
    g.fillStyle(shade(d.color, -0.45));
    for (let i = 0; i < 16; i++) tick(g, x, y, (i * TAU) / 16, 15.4, i % 4 ? 16.6 : 17.8, 1);
    CORNERS.forEach(([sx, sy], i) => {
      const cx = x + sx * 18.4,
        cy = y + sy * 18.4;
      polygon(g, cx, cy, 3.3, 4, OUTLINE, Math.PI / 4, 0.9);
      polygon(g, cx - 0.4, cy - 0.4, 2.5, 4, shade(PLATE, 0.18), Math.PI / 4);
      disc(g, cx, cy, 1.1, i === lit ? shade(d.color, 0.3) : shade(d.color, -0.6));
      if (i === lit) disc(glow, cx, cy, 3.4, d.color, 0.28);
    });
  },
  // Round plate with a spiral groove cut into its deck and three violet eyes staring out of the rim.
  spiral: (ctx) => {
    const { g, glow, x, y, definition: d, charge } = ctx,
      eyes = [0, 1, 2].map((i) => -Math.PI / 2 + (i * TAU) / 3);
    base(ctx, "disc", 22, 18);
    g.lineStyle(0.9, shade(d.color, -0.45), 0.8);
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = k * 0.55,
        r = 12.5 + k * 0.22;
      if (k) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.strokePath();
    for (const a of eyes) {
      const p = at(x, y, a, 20);
      oval(g, p.x, p.y, 3.4, 2.1, OUTLINE, 1, a + Math.PI / 2);
      oval(g, p.x - 0.2, p.y - 0.2, 2.6, 1.4, shade(d.color, 0.55), 1, a + Math.PI / 2);
      disc(g, p.x, p.y, 1, OUTLINE);
      disc(glow, p.x, p.y, 2.8, d.color, 0.08 + 0.18 * charge);
    }
  },
  // Hexagonal plate with honeycomb cells of set resin round the rim, each lit by where it faces.
  resin: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx;
    base(ctx, { n: 6 }, 23, 18);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * TAU) / 6,
        p = at(x, y, a, 19.6);
      polygon(g, p.x, p.y, 3, 6, OUTLINE, 0, 0.9);
      polygon(g, p.x - 0.3, p.y - 0.3, 2.1, 6, shade(d.color, -0.25 + 0.25 * facing(a)));
      if (energy) disc(glow, p.x, p.y, 2.6, d.color, energy);
    }
  },
  // Round plate ringed by eight pole pieces, alternately polarised: tower-blue and bare steel.
  magnet: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    g.fillStyle(OUTLINE, 0.9);
    for (let i = 0; i < 8; i++) tick(g, x, y, Math.PI / 8 + (i * Math.PI) / 4, 17.4, 21.8, 3.8);
    for (const steel of [false, true]) {
      g.fillStyle(steel ? shade(PLATE, 0.4) : shade(d.color, 0.1));
      for (let i = steel ? 1 : 0; i < 8; i += 2) tick(g, x - 0.3, y - 0.3, Math.PI / 8 + (i * Math.PI) / 4, 17.9, 21.2, 2.4);
    }
  },
  // Round intake with angled vent slats all round, like the cowling of a turbine.
  fan: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    for (const [color, w] of [[OUTLINE, 1], [shade(d.color, -0.3), 0.55]] as const) {
      g.fillStyle(color, 0.9);
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        quad(g, x, y, Math.cos(a), Math.sin(a), 17.6, 21.4, -0.7 * w, 0.7 * w, 1.6 - 0.9 * w, 1.6 + 0.9 * w);
      }
    }
  },
  // Chamfered mooring deck: four bollards at the corners, a chain run between them that lights up link by link as the grapple reloads.
  tether: (ctx) => {
    const { g, glow, x, y, definition: d, charge, energy } = ctx,
      c = d.color;
    base(ctx, { cut: 0.3 }, 22, 17);
    for (const [sx, sy] of CORNERS) {
      const bx = x + sx * 17.2,
        by = y + sy * 17.2;
      disc(g, bx + 0.8, by + 1.2, 3.4, SHADOW, 0.4);
      disc(g, bx, by, 3.2, shade(PLATE, -0.35));
      disc(g, bx - 0.4, by - 0.4, 2.3, shade(PLATE, 0.2));
      disc(g, bx, by, 1, OUTLINE);
    }
    // Chain links along the lower and right edges: alternating flat and edge-on links.
    const links = 8,
      lit = Math.floor(charge * links);
    for (let i = 0; i < links; i++) {
      const f = (i + 0.5) / links,
        p = i < links / 2 ? { x: x - 13 + f * 2 * 26, y: y + 19.6 } : { x: x + 19.6, y: y + 13 - (f - 0.5) * 2 * 26 },
        horizontal = i < links / 2;
      if (i % 2) chamferRect(g, p.x, p.y, horizontal ? 2.2 : 0.8, horizontal ? 0.8 : 2.2, 0.4, shade(c, -0.45));
      else {
        ring(g, p.x, p.y, 1.8, 0.9, shade(c, -0.2));
      }
      if (i < lit) disc(glow, p.x, p.y, 2.4, c, Math.min(0.3, 0.12 + energy));
    }
  },
  // Hexagonal emitter deck with three capacitor cells; their charge drains down as the next beam builds.
  shrinker: (ctx) => {
    const { g, glow, x, y, definition: d, charge, energy } = ctx,
      c = d.color,
      cells = [0, 1, 2].map((i) => at(x, y, Math.PI / 2 + (i * TAU) / 3, 19));
    base(ctx, { n: 6, rot: Math.PI / 6 }, 23, 18);
    for (const p of cells) {
      chamferRect(g, p.x, p.y, 3.4, 3.4, 1.1, OUTLINE, 0.9);
      chamferRect(g, p.x, p.y, 2.6, 2.6, 0.8, shade(c, -0.6));
      // The cell's fill is a bar rising from the bottom.
      const h = 5.2 * charge;
      if (h > 0.2) {
        g.fillStyle(shade(c, -0.1), 0.9);
        g.fillRect(p.x - 2, p.y + 2.6 - h, 4, h);
      }
      disc(glow, p.x, p.y, 3.6, c, Math.min(0.3, 0.05 + 0.15 * charge + energy));
    }
  },
  // A round ritual plate: an engraved circle and five rune studs that kindle one by one as the next shard forms.
  sigil: (ctx) => {
    const { g, glow, x, y, definition: d, charge, clock, tower: t } = ctx,
      c = d.color,
      lit = charge * 5;
    base(ctx, "disc", 22, 18);
    ring(g, x, y, 15.5, 0.8, shade(c, -0.35), 0.8);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5,
        p = at(x, y, a, 19.6),
        on = Math.max(0, Math.min(1, lit - i)),
        flicker = 0.85 + 0.15 * Math.sin(clock * 7 + i * 1.3 + t.id);
      polygon(g, p.x, p.y, 2.6, 4, OUTLINE, a);
      polygon(g, p.x - 0.3, p.y - 0.3, 1.7, 4, shade(c, -0.6 + 0.6 * on), a);
      if (on > 0) disc(glow, p.x, p.y, 3.4, c, 0.28 * on * flicker);
    }
  },
  // Round intake plate with four slotted vents that breathe in as the beam drains.
  siphon: (ctx) => {
    const { g, glow, x, y, definition: d, clock, tower: t, kick, energy } = ctx,
      c = d.color,
      vents = [0, 1, 2, 3].map((i) => Math.PI / 4 + (i * Math.PI) / 2),
      breath = 0.5 + 0.5 * Math.sin(clock * 3 + t.id);
    base(ctx, "disc", 22, 18);
    g.fillStyle(OUTLINE);
    for (const a of vents) for (const off of [-3, 0, 3]) tick(g, x + Math.cos(a + Math.PI / 2) * off, y + Math.sin(a + Math.PI / 2) * off, a, 16.4, 20.6, 1.4);
    glow.fillStyle(c, Math.min(0.3, 0.06 + 0.12 * breath + 0.15 * kick + energy));
    for (const a of vents) tick(glow, x, y, a, 16.6, 20.4, 7.4);
  },
  // Trampled ground under the wall, with stakes driven in at the corners.
  barricade: ({ g, x, y, definition: d, level }) => {
    oval(g, x, y, 20, 18, shade(d.color, -0.72), 0.75);
    if (level >= 5) ring(g, x, y, 20.5, 0.8, d.color, 0.5);
    for (const [sx, sy] of CORNERS) {
      disc(g, x + sx * 15 + 0.8, y + sy * 15 + 1.2, 2.2, SHADOW, 0.45);
      disc(g, x + sx * 15, y + sy * 15, 2, shade(d.color, -0.45));
      disc(g, x + sx * 15 - 0.5, y + sy * 15 - 0.5, 0.9, shade(d.color, 0.1));
    }
  },
  // A round pad in a ring of six emitter bolts.
  warp: ({ g, x, y, definition: d, level }) => {
    plate(g, x, y, "disc", 19, PLATE);
    sunken(g, x, y, "disc", 16.4, DARK);
    rivets(g, x, y, 17.8, 6, Math.PI / 6, shade(d.color, -0.45));
    if (level >= 5) inlay(g, x, y, "disc", 20.4, d.color, 0.5);
  },
  plate: (ctx) => trapFrame(ctx, 17),
  // A dark spill on the path; small splashes around it.
  slick: ({ g, x, y, definition: d, level }) => {
    oval(g, x + 1, y + 1, 20, 16.5, shade(d.color, -0.8), 0.85, 0.2);
    oval(g, x - 9, y + 8, 6, 4.5, shade(d.color, -0.75), 0.8, -0.4);
    oval(g, x + 11, y - 9, 5, 3.5, shade(d.color, -0.75), 0.8, 0.6);
    if (level >= 5) oval(g, x + 1, y + 1, 20.5, 17, d.color, 0.15, 0.2);
  },
  grinder: (ctx) => trapFrame(ctx, 18),
  // A sunken launch hatch.
  harpoon: ({ g, x, y, definition: d, level }) => {
    plate(g, x, y, { cut: 0.34 }, 18, PLATE);
    sunken(g, x, y, "disc", 14.4, DARK);
    g.fillStyle(shade(d.color, -0.5));
    for (const [sx, sy] of CORNERS) pip(g, x + sx * 14.6, y + sy * 14.6, 1.6);
    if (level >= 5) inlay(g, x, y, { cut: 0.34 }, 16.8, d.color, 0.5);
  },
  // Octagon with a clock dial on its deck: twelve hour ticks, the quarters long and lit.
  clock: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 19, "disc");
    g.fillStyle(shade(d.color, -0.45));
    for (let i = 0; i < 12; i++) if (i % 3) tick(g, x, y, (i * Math.PI) / 6, 16, 17.8, 1.2);
    g.fillStyle(shade(d.color, 0.1));
    for (let i = 0; i < 12; i += 3) tick(g, x, y, (i * Math.PI) / 6, 15.2, 18.6, 2.2);
    glow.fillStyle(d.color, 0.1 + energy);
    for (let i = 0; i < 12; i += 3) tick(glow, x, y, (i * Math.PI) / 6, 15, 18.8, 3);
    rivets(ctx.g, x, y, 21.2, 4, Math.PI / 4);
  },
  // Chamfered square with four crosshair notches cut into its rim.
  director: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx;
    base(ctx, { cut: 0.3 }, 23, 19, "disc");
    g.fillStyle(OUTLINE);
    for (let i = 0; i < 4; i++) tick(g, x, y, (i * Math.PI) / 2, 15.5, 22, 3.6);
    g.fillStyle(shade(d.color, -0.15));
    for (let i = 0; i < 4; i++) tick(g, x, y, (i * Math.PI) / 2, 16.2, 21, 1.2);
    glow.fillStyle(d.color, 0.1 + energy);
    for (let i = 0; i < 4; i++) tick(glow, x, y, (i * Math.PI) / 2, 16, 21.5, 2.4);
  },
  // Square magazine plate: racks of cartridges along two sides, brass bodies with tips in the tower colour.
  armory: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.22 }, 23, 17.5);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const cx = x + (i - 2) * 5.2,
          cy = y + side * 20.3;
        disc(g, cx + 0.5, cy + 0.8, 2.1, SHADOW, 0.5);
        disc(g, cx, cy, 2, 0xb08a3a);
        disc(g, cx - 0.4, cy - 0.4, 1.1, shade(d.color, 0.25));
      }
    }
    rivets(g, x, y, 20.3, 2, 0);
  },
  // Round plate with three lit struts bracing the dish.
  skylink: (ctx) => {
    const { g, x, y, definition: d, level } = ctx,
      struts = [0, 1, 2].map((i) => -Math.PI / 2 + (i * TAU) / 3);
    base(ctx, "disc", 23, 18, { n: 6 });
    for (const a of struts) litBar(g, x, y, a, 12, 21, 2.2, 1.6, shade(PLATE, 0.1));
    struts.forEach((a, i) => {
      const p = at(x, y, a, 21);
      led(ctx, p.x, p.y, d.color, i < level ? 1 : 0.15);
    });
  },
  // Hexagon with a socket at every corner and the lattice engraved between them.
  nexus: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 6 }, 24, 19);
    hexLine(g, x, y, 15.5, 0.9, shade(d.color, -0.3), 0.8);
    g.fillStyle(OUTLINE);
    for (let i = 0; i < 6; i++) {
      const p = at(x, y, (i * Math.PI) / 3, 20.5);
      pip(g, p.x, p.y, 2.4);
    }
    g.fillStyle(shade(d.color, -0.2));
    for (let i = 0; i < 6; i++) {
      const p = at(x, y, (i * Math.PI) / 3, 20.5);
      pip(g, p.x, p.y, 1.3);
    }
  },
  // Chamfered workbench with a tool rack of four wrenches along its edges.
  workshop: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.22 }, 23, 18, { cut: 0.3 });
    for (const [sx, sy] of CORNERS) {
      const a = Math.atan2(sy, sx);
      litBar(g, x + sx * 15.5, y + sy * 15.5, a + Math.PI / 2, -3.2, 3.2, 0.9, 0.9, shade(d.color, -0.3), { shadow: false });
    }
    g.fillStyle(shade(d.color, -0.45));
    for (let i = 0; i < 4; i++) tick(g, x, y, (i * Math.PI) / 2, 18.4, 22, 2.4);
  },
  // Octagonal strongroom frame held by eight bolts.
  vault: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 19, "disc");
    rivets(g, x, y, 21.4, 8, Math.PI / 8, shade(d.color, -0.55));
  },
  // Hexagonal pad with three capacitor cells that glow with the stored shield.
  shieldgen: (ctx) => {
    const { g, glow, x, y, definition: d, clock, tower: t } = ctx,
      cells = [0, 1, 2].map((i) => at(x, y, Math.PI / 2 + (i * TAU) / 3, 19.5)),
      hum = 0.5 + 0.5 * Math.sin(clock * 2.4 + t.id);
    base(ctx, { n: 6 }, 23, 18);
    g.fillStyle(OUTLINE);
    for (const p of cells) pip(g, p.x, p.y, 3.2);
    g.fillStyle(shade(d.color, -0.1));
    for (const p of cells) pip(g, p.x - 0.3, p.y - 0.3, 2);
    glow.fillStyle(d.color, 0.08 + 0.1 * hum);
    for (const p of cells) pip(glow, p.x, p.y, 3);
  },
  // Round hopper with the recycling chevrons engraved around its rim.
  recycler: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 3,
        p = at(x, y, a, 20);
      polygon(g, p.x, p.y, 2.8, 3, shade(d.color, -0.35 + 0.25 * facing(a)), a + Math.PI / 2);
    }
  },
};
