import type { TurretStyle } from "../../core/types";
import { DARK, LIGHT, OUTLINE, PLATE, SHADOW, dome, halo, led, litBar } from "../material";
import { wallShareOf } from "../../systems/barricade";
import { arcBand, chamferRect, disc, hash01, oval, ring, shade, star } from "../shapes";
import { type Drawing, TAU, PTS, put, at, point, tick, pip, bar, loop, boss, armedLed, crackle, CORNERS } from "./kit";
/** Turret drawings of the Traps tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. */
export const TRAPS_TURRETS = {
  // A domed mine: the reload arc closes into a ring once armed, and the fuse blinks.
  mine: (ctx) => {
    const { g, glow, x, y, definition: d, clock, charge } = ctx,
      c = d.color;
    boss(g, x, y, 10, shade(c, -0.5));
    disc(g, x - 0.3, y - 0.3, 6.6, shade(c, -0.15), 0.4 + 0.6 * charge);
    g.fillStyle(shade(c, -0.3));
    for (let i = 0; i < 4; i++) {
      const p = at(x, y, (i * Math.PI) / 2 + Math.PI / 4, 11);
      pip(g, p.x, p.y, 1.9);
    }
    arcBand(g, x, y, 8.3, 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * charge, c, 0.85);
    if (charge >= 1) {
      ring(glow, x, y, 8.3, 2.6, c, 0.18);
      disc(g, x, y, 1.8, 0xffffff, 0.5 + 0.5 * Math.sin(clock * 6));
    }
    armedLed(ctx);
  },
  // Rows of spikes that shoot up on each strike; each is lit on its left face.
  spikes: (ctx) => {
    const { g, x, y, definition: d, kick } = ctx,
      c = d.color,
      h = 3 + 5 * kick;
    for (const half of [-1, 1]) {
      g.fillStyle(half < 0 ? shade(c, 0.1 + 0.4 * kick) : shade(c, -0.5 + 0.3 * kick));
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const sx = x + i * 11,
            sy = y + j * 11 + 3;
          g.fillTriangle(sx + half * 3, sy, sx, sy, sx, sy - h);
        }
    }
    armedLed(ctx);
  },
  // Bubbling tar with a glossy sheen.
  tar: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock } = ctx,
      c = d.color;
    oval(g, x, y, 15, 12.5, shade(c, -0.35), 0.9);
    oval(g, x - 5.4, y - 6, 6.5, 1.8, shade(c, 0.5), 0.45, -0.55);
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.7 + i / 3 + t.id * 0.2) % 1;
      loop(g, x - 7 + i * 7, y - 2 + (i % 2) * 5, 1 + phase * 4, 1.2, shade(c, 0.4), 1 - phase);
    }
  },
  // Open jaws with two-tone teeth that snap shut and spring back open while re-arming.
  snare: (ctx) => {
    const { g, x, y, definition: d, charge } = ctx,
      c = d.color,
      open = 3 + 9 * charge;
    // Hinge springs at both ends of the jaws.
    g.lineStyle(1, shade(c, -0.2));
    g.beginPath();
    for (const sx of [-1, 1])
      for (let k = 0; k <= 6; k++) {
        const kx = x + sx * (13.2 + (k % 2 ? 1.2 : -1.2)),
          ky = y - open + (k * open) / 3;
        if (k) g.lineTo(kx, ky);
        else g.moveTo(kx, ky);
      }
    g.strokePath();
    loop(g, x, y, 5, 1.5, shade(c, -0.3));
    for (const side of [-1, 1]) {
      const jy = y + side * open;
      for (const half of [-1, 1]) {
        g.fillStyle(half < 0 ? shade(c, 0.3) : shade(c, -0.35));
        for (let i = 0; i < 5; i++) {
          const tx = x - 10 + i * 5;
          g.fillTriangle(tx + half * 1.8, jy, tx, jy, tx, jy - side * 4);
        }
      }
      g.fillStyle(c);
      g.fillRect(x - 12, jy - 1.5, 24, 3);
      g.fillStyle(shade(c, 0.4));
      g.fillRect(x - 12, jy - 1.5, 24, 1);
    }
    armedLed(ctx);
  },
  // A grate: heat glows in the slots between the bars, and embers rise from it.
  grill: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color,
      heat = 0.55 + 0.25 * Math.sin(clock * 5 + t.id) + 0.2 * kick;
    g.fillStyle(c, 0.3 + 0.5 * heat);
    for (let i = -2; i < 2; i++) g.fillRect(x - 13, y + i * 6 + 1.5, 26, 3);
    glow.fillStyle(c, 0.1 + 0.12 * Math.min(1, heat));
    for (let i = -2; i < 2; i++) glow.fillRect(x - 13, y + i * 6 + 1, 26, 4);
    g.fillStyle(shade(c, -0.62));
    for (let i = -2; i <= 2; i++) g.fillRect(x - 14, y + i * 6 - 1.5, 28, 3);
    g.fillStyle(shade(c, -0.35));
    for (let i = -2; i <= 2; i++) g.fillRect(x - 14, y + i * 6 - 1.5, 28, 1);
    for (let i = 0; i < 2; i++) {
      const phase = (clock * 0.8 + i * 0.5 + t.id * 0.27) % 1;
      disc(g, x - 6 + i * 11 + Math.sin(clock * 3 + i) * 2, y + 4 - phase * 16, 0.9, shade(c, 0.5), 1 - phase);
    }
  },
  // A coil spring under a launch plate, compressed while it re-arms; the near strands catch the light.
  spring: (ctx) => {
    const { g, x, y, definition: d, charge, kick } = ctx,
      c = d.color,
      h = 4 + 6 * charge + 6 * kick,
      top = y + 6 - h;
    for (const front of [false, true]) {
      g.lineStyle(front ? 1.6 : 1.4, shade(c, front ? 0.3 : -0.4));
      for (let i = 0; i < 4; i++) {
        const y0 = y + 8 - (i * h) / 4;
        if (front) g.lineBetween(x - 7, y0, x + 7, y0 - h / 8);
        else g.lineBetween(x + 7, y0 - h / 8, x - 7, y0 - h / 4);
      }
    }
    chamferRect(g, x, top - 2, 10, 2.2, 1, shade(c, -0.1));
    chamferRect(g, x - 0.3, top - 2.9, 9.4, 1, 0.6, shade(c, 0.35));
    armedLed(ctx);
  },
  // A magnetic disc carrying the next bomb, with field lines turning around it; empty until it re-arms.
  limpet: (ctx) => {
    const { g, glow, x, y, definition: d, clock, charge } = ctx,
      c = d.color;
    ring(g, x, y, 11, 1.5, shade(c, -0.3));
    for (let i = 0; i < 3; i++) {
      const b = clock * 0.8 + (i * TAU) / 3;
      arcBand(glow, x, y, 12.6, 1, b, b + 0.9, c, 0.1 + 0.08 * charge);
    }
    if (charge >= 1) {
      boss(g, x, y, 7, shade(c, -0.4));
      led(ctx, x, y - 3, c, 0.7 * (0.5 + 0.5 * Math.sin(clock * 8)));
    }
    armedLed(ctx);
  },
  // Planks slide over the shaft while it re-arms and open once it is ready.
  pit: (ctx) => {
    const { g, x, y, definition: d, charge } = ctx,
      c = d.color,
      cover = 1 - charge;
    if (cover > 0) {
      g.fillStyle(shade(c, 0.1));
      for (let i = -1; i <= 1; i++) g.fillRect(x - 15, y + i * 9 - 3.5, 30 * cover, 7);
      g.fillStyle(shade(c, 0.35));
      for (let i = -1; i <= 1; i++) g.fillRect(x - 15, y + i * 9 - 3.5, 30 * cover, 1.2);
    }
    armedLed(ctx);
  },
  // The wire between the posts: taut and glowing when armed, with a glint running along it.
  tripwire: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, kick } = ctx,
      c = d.color,
      sag = (1 - charge) * 6 + kick * 4;
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      put(i, x - 15 + 30 * f, y + Math.sin(f * Math.PI) * sag + (charge >= 1 ? Math.sin(clock * 30 + i) * 0.4 : 0));
    }
    glow.lineStyle(3, c, 0.06 + 0.14 * charge);
    glow.strokePoints(PTS, false, false, 7);
    g.lineStyle(1.5, c, 0.4 + 0.6 * charge);
    g.strokePoints(PTS, false, false, 7);
    if (charge >= 1) {
      const gx = x - 15 + 30 * ((clock * 0.8 + t.id * 0.37) % 1);
      disc(glow, gx, y, 3, c, 0.2);
      disc(g, gx, y, 1, 0xffffff, 0.9);
    }
    g.fillStyle(c);
    pip(g, x - 16, y, 2.2);
    pip(g, x + 16, y, 2.2);
    armedLed(ctx);
  },
  // A steel hedgehog of three crossed beams with spiked ends. It darkens and cracks as enemies chew on it, its HP
  // pips run down above it, and a breached one lies in pieces until the wave ends.
  barricade: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color,
      share = wallShareOf(t, d);
    if (share <= 0) {
      for (let i = 0; i < 6; i++) {
        const a = hash01(t.id, i) * TAU,
          r = 3 + 11 * hash01(i, t.id, 1);
        litBar(g, x + Math.cos(a) * r, y + Math.sin(a) * r, a + i * 1.3, -4, 4, 1.5, 1.2, shade(c, -0.35));
      }
      led(ctx, x + 14, y - 14, 0xff4d4d, Math.sin(clock * 8) > 0 ? 0.8 : 0.1);
      return;
    }
    const worn = 1 - share,
      jolt = kick * Math.sin(clock * 70) * 0.8,
      beams = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];
    for (const [i, a] of beams.entries()) {
      litBar(g, x + jolt, y, a, -15, 15, 2.8, 2.8, shade(c, -0.1 - 0.45 * worn * (i === 1 ? 1.2 : 1)), { bands: [0.3, 0.7] });
      // Spiked ends in bright steel.
      g.fillStyle(shade(PLATE, 0.55));
      for (const end of [-1, 1]) {
        const ca = Math.cos(a) * end,
          sa = Math.sin(a) * end,
          tx = x + jolt + ca * 15,
          ty = y + sa * 15;
        g.fillTriangle(tx - sa * 2.4, ty + ca * 2.4, tx + sa * 2.4, ty - ca * 2.4, tx + ca * 4.5, ty + sa * 4.5);
      }
    }
    // Cracks open as the wall weakens.
    if (worn > 0.33) {
      g.lineStyle(1.1, OUTLINE, 0.9);
      g.beginPath();
      for (let k = 0; k < (worn > 0.66 ? 3 : 1); k++) {
        const p = at(x, y, beams[k], 6 + 3 * k);
        g.moveTo(p.x - 2, p.y - 2.5);
        g.lineTo(p.x + 1, p.y);
        g.lineTo(p.x - 1, p.y + 2.5);
      }
      g.strokePath();
    }
    dome(g, x + jolt, y, 3.6, shade(PLATE, 0.2));
    // HP pips across the top: lit while the wall holds, the last one blinking when it is about to give.
    const pips = 5,
      lit = Math.ceil(share * pips);
    for (let i = 0; i < pips; i++) {
      const left = x - 12 + i * 5,
        on = i < lit && !(i === lit - 1 && share < 0.25 && Math.sin(clock * 10) < 0);
      g.fillStyle(OUTLINE, 0.9);
      g.fillRect(left - 0.6, y - 21.6, 4.2, 3.2);
      g.fillStyle(on ? (share > 0.5 ? shade(c, 0.45) : 0xff6a3d) : DARK);
      g.fillRect(left, y - 21, 3, 2);
    }
  },
  // A portal: spiral arms turn over a black core, faster once it is charged; it flashes when it folds an enemy back.
  warp: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, kick } = ctx,
      c = d.color,
      ready = charge >= 1,
      spin = clock * (ready ? 3.2 : 0.9) + t.id;
    disc(g, x, y, 13.6, OUTLINE);
    disc(g, x, y, 12.4, 0x04060f);
    if (ready) disc(glow, x, y, 12, c, 0.12 + 0.05 * Math.sin(clock * 4 + t.id));
    for (const ink of ready ? [glow, g] : [g]) {
      const light = ink === glow;
      ink.lineStyle(light ? 3.2 : 1.4, light ? c : shade(c, 0.35), light ? 0.22 : ready ? 0.95 : 0.45);
      ink.beginPath();
      for (let arm = 0; arm < 3; arm++)
        for (let k = 0; k < 8; k++) {
          const a = spin + (arm * TAU) / 3 + k * 0.32,
            r = 11.5 - k * 1.3;
          if (k) ink.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          else ink.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
      ink.strokePath();
    }
    arcBand(g, x, y, 15.4, 1.4, -Math.PI / 2, -Math.PI / 2 + TAU * charge, c, 0.85);
    disc(g, x, y, 1.6, ready ? 0xffffff : shade(c, -0.3), ready ? 0.85 : 0.6);
    if (kick > 0) {
      ring(glow, x, y, 4 + 14 * (1 - kick), 2, shade(c, 0.4), 0.45 * kick);
      disc(g, x, y, 5 * kick, 0xffffff, 0.7 * kick);
    }
    armedLed(ctx);
  },
  // A square copper coil set into the floor around a terminal; sparks crawl over it once it is charged.
  plate: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, kick } = ctx,
      c = d.color;
    for (let k = 0; k < 10; k++) {
      const [sx, sy] = CORNERS[k % 4],
        r = 12 - k * 1.05;
      put(k, x + sx * r, y + sy * r);
    }
    g.lineStyle(2.4, OUTLINE, 0.9);
    g.strokePoints(PTS, false, false, 10);
    g.lineStyle(1.3, shade(c, -0.45 + 0.35 * charge), 1);
    g.strokePoints(PTS, false, false, 10);
    if (charge >= 1) {
      glow.lineStyle(2.6, c, 0.12 + 0.06 * Math.sin(clock * 9 + t.id));
      glow.strokePoints(PTS, false, false, 10);
      const step = Math.floor(clock * 14);
      for (let i = 0; i < 2; i++) crackle(glow, x, y, hash01(t.id, step, i) * TAU, 3, 12, shade(c, 0.3), 0.55, step + i);
    }
    dome(g, x, y, 3.4, shade(c, -0.25));
    if (kick > 0) {
      halo(glow, x, y, 16, c, 0.4 * kick);
      disc(g, x, y, 3 * kick, 0xffffff, kick);
    }
    armedLed(ctx);
  },
  // A glossy oil spill with a slow rainbow sheen; a drum on its side keeps it topped up, and fresh oil ripples out.
  slick: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color;
    oval(g, x, y + 1, 15, 11.5, shade(c, -0.55), 0.95, 0.2);
    oval(g, x - 1, y, 13, 9.5, shade(c, -0.35), 0.9, 0.2);
    for (const [i, hue] of [0xff7ad9, 0x7affd4, 0xffe27a].entries()) {
      const a = clock * 0.35 + t.id + i * 2.1;
      arcBand(g, x - 1, y, 6 + i * 2.2, 1.2, a, a + 1.4, hue, 0.22);
    }
    oval(g, x - 5.5, y - 4.5, 4.5, 1.4, 0xffffff, 0.35, -0.5);
    chamferRect(g, x + 12.6, y - 12, 5.4, 3.6, 1, shade(c, -0.6));
    chamferRect(g, x + 12.2, y - 12.6, 5, 2.6, 1, shade(c, -0.15));
    g.fillStyle(shade(c, -0.6));
    g.fillRect(x + 9.6, y - 15, 1, 6);
    g.fillRect(x + 14.6, y - 15, 1, 6);
    const drip = (clock * 1.3 + t.id * 0.3) % 1;
    disc(g, x + 8, y - 9 + drip * 5, 1.1, shade(c, -0.2), 1 - drip);
    if (kick > 0) loop(g, x, y, 4 + 11 * (1 - kick), 1.2, shade(c, 0.4), 0.7 * kick);
  },
  // Two toothed rollers turning against each other; they jerk on every bite.
  grinder: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, kick, level } = ctx,
      c = d.color,
      turn = clock * 3 + t.id + kick * 0.6;
    for (const side of [-1, 1]) {
      const gx = x + side * 6.6,
        rot = side * turn;
      star(g, gx + 0.8, y + 1.2, 8.4, 6.4, 10, SHADOW, rot, 0.5);
      star(g, gx, y, 8.4, 6.4, 10, shade(c, -0.35), rot);
      disc(g, gx - 0.3, y - 0.3, 6, shade(c, -0.05));
      arcBand(g, gx, y, 5.4, 1, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.4), 0.85);
      g.fillStyle(shade(c, -0.45));
      for (let i = 0; i < 3; i++) tick(g, gx, y, rot + (i * TAU) / 3, 1.5, 5.2, 1);
      disc(g, gx, y, 1.7, OUTLINE);
    }
    // The nip between the rollers, hot after a bite on a fully upgraded grinder.
    g.fillStyle(OUTLINE);
    g.fillRect(x - 0.8, y - 7, 1.6, 14);
    if (kick > 0 && level >= 5) bar(glow, x, y, Math.PI / 2, -7, 7, 1.2, 1.2, c, 0.35 * kick);
    armedLed(ctx);
  },
  // A launcher tube aiming up the flight line inside a coil of rope; the barbed head shows once it is loaded.
  harpoon: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, charge, kick } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      // The rope coil pays out with a shot and winds back up as the trap reloads.
      coil = 8.5 + 3 * charge;
    loop(g, x, y, coil, 2.2, 0x8a6d45, 0.95);
    loop(g, x, y, coil - 0.7, 0.6, 0xc8a46b, 0.8);
    litBar(g, x, y, a, -6, 9, 3.6, 3, shade(c, -0.2), { bands: [0.35, 0.7] });
    if (charge >= 1) {
      const tip = point(x, y, ca, sa, 13.5, 0),
        neck = point(x, y, ca, sa, 9, 0);
      g.fillStyle(shade(PLATE, 0.6));
      g.fillTriangle(neck.x - sa * 3.4, neck.y + ca * 3.4, neck.x + sa * 3.4, neck.y - ca * 3.4, tip.x, tip.y);
      g.fillStyle(shade(PLATE, 0.2));
      g.fillTriangle(neck.x + sa * 3.4, neck.y - ca * 3.4, neck.x, neck.y, tip.x, tip.y);
      halo(glow, tip.x, tip.y, 4, c, 0.18);
    } else disc(g, x + ca * 9, y + sa * 9, 2.2, OUTLINE);
    if (kick > 0) halo(glow, x + ca * 10, y + sa * 10, 7, c, 0.3 * kick);
    dome(g, x, y, 4, shade(c, -0.3));
    armedLed(ctx);
  },
} satisfies Partial<Record<TurretStyle, Drawing>>;
