import type { TurretStyle } from "../../core/types";
import { DARK, LIGHT, OUTLINE, PLATE, SHADOW, dome, facing, halo, led, litBar, plate } from "../material";
import { MUZZLES } from "../muzzles";
import { arcBand, chamferRect, disc, hash01, oval, polygon, ring, shade, strip, wedge } from "../shapes";
import { type Drawing, TAU, at, point, quad, tick, pip, bar, loop, block, facets, boss, glowDot, reach, bolt, muzzleGlow, crackle } from "./kit";
/** Turret drawings of the Attack tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. */
export const ATTACK_TURRETS = {
  // A barrel with a muzzle brake on a domed mount; a slot in the dome glows as the next shot charges.
  barrel: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "barrel"),
      w = level >= 3 ? 0.5 : 0;
    litBar(g, x, y, a, back + 3, end - 3.5, 3.5 + w, 2.7 + w, c, { bands: level >= 3 ? [0.45, 0.6] : undefined });
    litBar(g, x, y, a, end - 4, end, 4 + w, 4 + w, shade(c, -0.3), { bands: [0.5], tip });
    const bore = at(x, y, a, end - 1.2);
    disc(g, bore.x, bore.y, 1.6, OUTLINE);
    dome(g, x, y, 9, c);
    bar(g, x, y, a, -7.4, -3.6, 1.4, 1.4, OUTLINE, 0.9);
    bar(g, x, y, a, -7, -4, 0.6, 0.6, shade(c, 0.45), 0.3 + 0.6 * charge);
    bar(glow, x, y, a, -7.4, -3.6, 1.3, 1.3, c, Math.min(0.6, 0.2 + 0.4 * charge + energy));
    bolt(ctx);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A wide launch tube: the next rocket's nose slides out as it loads, and the rear vents puff on a shot.
  heavy: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "heavy"),
      w = level >= 3 ? 0.8 : 0,
      out = 5 * Math.min(1, Math.max(0, (charge - 0.3) / 0.7));
    if (out > 0.3) {
      const ca = Math.cos(a),
        sa = Math.sin(a),
        lit = facing(a + Math.PI / 2) < 0 ? -1 : 1;
      strip(g, x, y, ca, sa, end - 2, end + out, -3.3, 3.3, -0.7, 0.7, shade(c, 0.35));
      strip(g, x, y, ca, sa, end - 2, end + out, 0, lit * 3.3, 0, lit * 0.7, shade(c, 0.6));
    }
    litBar(g, x, y, a, back + 4, end - 3, 5.5 + w, 5 + w, c, { bands: level >= 3 ? [0.25, 0.4, 0.75] : [0.3] });
    litBar(g, x, y, a, end - 3, end, 6.5 + w, 6.5 + w, shade(c, -0.25), { tip });
    boss(g, x, y, 10, shade(c, -0.05));
    // Rear vents; they glow and puff smoke right after a shot.
    const vents = [-1, 1].map((sign) => a + Math.PI + sign * 0.6);
    g.fillStyle(shade(c, -0.7));
    for (const va of vents) tick(g, x, y, va, 5.5, 8.5, 1.6);
    if (kick > 0) {
      glow.fillStyle(c, 0.3 * kick);
      for (const va of vents) tick(glow, x, y, va, 5, 9, 3);
      g.fillStyle(0x8f989e, 0.5 * kick);
      for (const va of vents) pip(g, x + Math.cos(va) * (9 + 7 * (1 - kick)), y + Math.sin(va) * (9 + 7 * (1 - kick)), 1.5 + 3 * (1 - kick));
    }
    bolt(ctx, 3.2);
    muzzleGlow(ctx, end + 2, 6);
  },
  // Twin guns on a chamfered yoke, fed from an ammo box on the left.
  twin: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, tip } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "twin"),
      sides = MUZZLES.twin!.sides!;
    block(g, x + 0.5, y + 0.8, a, 7.5, 8.5, 3, shade(c, -0.62));
    block(g, x - 0.3, y - 0.3, a, 6.8, 7.8, 2.6, shade(c, -0.35));
    strip(g, x, y, ca, sa, -4.5, 4.5, -12.2, -6.8, -12.2, -6.8, shade(c, -0.6));
    strip(g, x, y, ca, sa, -4, 4, -11.7, -9.6, -11.7, -9.6, shade(c, -0.35));
    g.fillStyle(shade(c, 0.2), 0.9);
    for (const k of [-2.5, 0, 2.5]) quad(g, x, y, ca, sa, k - 0.5, k + 0.5, -11.3, -7.7, -11.3, -7.7);
    for (const side of sides) {
      litBar(g, x, y, a, back + 2, end - 3, 1.8, 1.5, c, { side, bands: level >= 3 ? [0.45, 0.6] : undefined });
      bar(g, x, y, a, end - 3.5, end, 2.4, 2.4, tip ?? shade(c, -0.3), 1, side);
    }
    g.fillStyle(OUTLINE);
    for (const side of sides) {
      const v = point(x, y, ca, sa, end - 1.8, side);
      pip(g, v.x, v.y, 0.75);
    }
    bolt(ctx);
    muzzleGlow(ctx, end + 1.5, 4);
  },
  // A Tesla coil: metal toroids around a domed top ball that crackles when charged and flashes white on a discharge.
  coil: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy, peak } = ctx,
      c = d.color;
    // Insulator spokes turning slowly under the rings.
    g.fillStyle(shade(c, -0.45));
    for (let i = 0; i < 4; i++) {
      const b = clock * 0.5 + t.id + (i * Math.PI) / 2;
      quad(g, x, y, Math.cos(b), Math.sin(b), 9, 15.5, -1.6, 1.6, -1.1, 1.1);
    }
    for (const r of level >= 3 ? [12, 9, 6] : [10, 7]) {
      loop(g, x, y, r, 3, shade(c, -0.55));
      loop(g, x - 0.3, y - 0.3, r, 1.2, c);
    }
    glowDot(glow, x, y, 10, c, Math.min(peak, 0.15 + 0.35 * charge + energy));
    dome(g, x, y, 4.5, shade(c, 0.85 * kick));
    // Sparks jump to the rings once charged: one past 60 %, two past 90 %, re-rolled 20 times a second.
    const seed = Math.floor(clock * 20) + t.id * 7;
    for (let i = 0; i < (charge > 0.9 ? 2 : charge > 0.6 ? 1 : 0); i++)
      crackle(glow, x, y, hash01(seed, i) * TAU, 5, level >= 3 ? 13.5 : 11.5, shade(c, 0.5), 0.35, seed + i * 13);
    if (kick > 0) ring(glow, x, y, 10 + (1 - kick) * 8, 2, shade(c, 0.5), 0.35 * kick);
  },
  // Twin rails on a capacitor block: three lamps per side fill with the charge, and the rails' fronts flare on a shot.
  rail: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, charge, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "rail"),
      length = end - back;
    litBar(g, x, y, a, -9, 8, 7, 6, shade(c, -0.65));
    for (let i = 0; i < 3; i++) {
      const on = Math.min(1, Math.max(0, charge * 3 - i));
      g.fillStyle(on > 0 ? shade(c, -0.75 * (1 - on)) : OUTLINE);
      for (const side of [-5.6, 5.6]) {
        const p = point(x, y, ca, sa, -8.2 + i * 2.8, side);
        pip(g, p.x, p.y, 1.1);
      }
    }
    for (const side of [-3.5, 3.5]) {
      litBar(g, x, y, a, back, end, 1.7, 1.3, shade(c, -0.2), { side, tip, bands: level >= 3 ? [0.45, 0.6] : undefined });
      if (kick > 0) bar(g, x, y, a, end - 0.3 * length, end, 1.7, 1.3, shade(c, 0.6), kick, side);
    }
    if (kick > 0) bar(glow, x, y, a, end - 0.3 * length, Math.min(end, 26), 5.5, 5, c, 0.5 * kick);
    // The charge runs along the rails until the next shot.
    const run = back + 2 + (length - 4) * charge;
    bar(g, x, y, a, back + 2, run, 0.9, 0.9, c, 0.3 + 0.7 * charge);
    bar(glow, x, y, a, back + 2, Math.min(run, 26), 1.8, 1.8, c, Math.min(0.5, 0.12 + 0.25 * charge + energy));
    boss(g, x, y, 5, shade(c, -0.45));
    bolt(ctx, 2.2);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A flamethrower: a scorched nozzle with a pilot flame over a furnace whose window flickers.
  flame: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "flame"),
      flicker = 0.75 + 0.25 * Math.sin(clock * 13 + t.id * 1.7);
    litBar(g, x, y, a, back + 2, end - 3, 4, 5.6, shade(c, -0.45), { bands: level >= 3 ? [0.45, 0.62] : undefined });
    litBar(g, x, y, a, end - 3, end, 6.5, 6.5, shade(c, -0.72), { tip });
    const mouth = at(x, y, a, end + 1.2);
    bar(g, x, y, a, end - 0.5, end + 1 + 4 * flicker, 1.7, 0, shade(c, 0.3));
    disc(glow, mouth.x, mouth.y, 3.2, c, 0.25);
    boss(g, x, y, 10, shade(c, -0.55));
    disc(g, x, y, 7, OUTLINE);
    disc(g, x, y, 5.6 * flicker, c);
    disc(g, x, y, 2.8 * flicker, shade(c, 0.6));
    glowDot(glow, x, y, 12, c, Math.min(peak, 0.18 + 0.12 * flicker + energy));
    // Embers circling the core from level 3.
    if (level >= 3) {
      g.fillStyle(shade(c, 0.3), 0.5 + 0.5 * flicker);
      for (let i = 0; i < 3; i++) {
        const p = at(x, y, clock * 2 + t.id + (i * TAU) / 3, 12);
        pip(g, p.x, p.y, 1.4);
      }
    }
    muzzleGlow(ctx, end + 2, 5);
  },
  // A stubby tube that recoils hard, a shell nose in its bore once loaded; the dead zone is drawn with the range preview.
  mortar: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "mortar");
    boss(g, x, y, 11, shade(c, -0.55));
    litBar(g, x, y, a, back - 2, end, 6.5, 7, shade(c, -0.2), { bands: level >= 3 ? [0.3, 0.42] : [0.36], tip });
    const mouth = at(x, y, a, end - 4.2);
    disc(g, mouth.x, mouth.y, 4.4, OUTLINE);
    if (charge > 0.85) dome(g, mouth.x, mouth.y, 2.5, shade(c, 0.1));
    bolt(ctx, 2);
    muzzleGlow(ctx, end + 1, 6);
  },
  // A piston plate that rises while charging and slams down on the shot; its shadow falls further the higher it is.
  hammer: (ctx) => {
    const { g, glow, x, y, definition: d, kick, charge, energy } = ctx,
      c = d.color,
      lift = charge * 4 * (1 - kick);
    boss(g, x, y, 12, shade(c, -0.55));
    chamferRect(g, x + 1 + 0.6 * lift, y + 1.5 + 0.6 * lift, 8, 8, 3, SHADOW, 0.45);
    plate(g, x, y - lift, { cut: 0.35 }, 8, shade(c, -0.15));
    g.fillStyle(c, 0.4 + 0.6 * charge);
    g.fillRect(x - 5, y - 2 - lift, 10, 4);
    glow.fillStyle(c, Math.min(0.5, 0.12 + 0.2 * charge + energy));
    glow.fillRect(x - 6, y - 3 - lift, 12, 6);
    if (kick > 0) {
      g.fillStyle(shade(c, 0.25), 0.55 * kick);
      for (let i = 0; i < 4; i++) {
        const p = at(x, y, Math.PI / 4 + (i * Math.PI) / 2, 10 + 9 * (1 - kick));
        pip(g, p.x, p.y, 1.8 + 2.4 * (1 - kick));
      }
      ring(g, x, y, 10 + (1 - kick) * 16, 1 + 2 * kick, shade(c, 0.4), 0.8 * kick);
    }
  },
  // A long single blade with a dark fuller and a glowing edge; a glaive waits at the hilt once charged.
  blade: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "blade");
    litBar(g, x, y, a, back - 4, end, 3.5, 0.6, shade(c, -0.1), { tip });
    bar(g, x, y, a, back + 1, end - 8, 0.8, 0.35, shade(c, -0.6));
    strip(glow, x, y, ca, sa, back - 2, end - 1, 3.4, 2.2, 0.7, 0.2, shade(c, 0.4), Math.min(0.5, 0.2 * charge + energy));
    const guard = at(x, y, a, back + 7.4);
    litBar(g, guard.x, guard.y, a + Math.PI / 2, -5, 5, 1.2, 1.2, shade(c, -0.35));
    boss(g, x, y, 7, shade(c, -0.55));
    if (charge >= 0.95) {
      // A small glaive of three curved blades, ready to be thrown.
      const spin = clock * 1.5 + t.id;
      disc(glow, x, y, 6, c, 0.25);
      g.fillStyle(shade(c, 0.25));
      for (let k = 0; k < 3; k++) {
        const b = spin + (k * TAU) / 3,
          p0 = at(x, y, b, 1.2),
          p1 = at(x, y, b + 0.35, 4.2),
          p2 = at(x, y, b + 1.05, 6.2),
          p3 = at(x, y, b + 0.7, 3.4);
        g.fillTriangle(p0.x, p0.y, p1.x, p1.y, p3.x, p3.y);
        g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
      disc(g, x, y, 1.6, shade(c, -0.4));
    } else bolt(ctx, 2.4);
    muzzleGlow(ctx, end, 4);
  },
  // A fan of short barrels, more of them with each upgrade, fed by a rear drum that turns one chamber per shot.
  scatter: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "scatter"),
      { count, step } = MUZZLES.scatter!.fan!(level);
    for (let i = 0; i < count; i++) {
      const o = (i - (count - 1) / 2) * step;
      litBar(g, x, y, a + o, back + 4, end, 2, 1.6, shade(c, -0.2), { tip, shadow: i === 0 || i === count - 1, bands: level >= 3 ? [0.5] : undefined });
    }
    const drum = at(x, y, a, -3);
    disc(g, drum.x + 0.6, drum.y + 1, 7, SHADOW, 0.4);
    disc(g, drum.x, drum.y, 6.5, shade(c, -0.55));
    disc(g, drum.x - 0.4, drum.y - 0.4, 5.6, shade(c, -0.25));
    g.fillStyle(OUTLINE);
    for (let k = 0; k < 6; k++) {
      const p = at(drum.x, drum.y, a + charge * (Math.PI / 3) + (k * Math.PI) / 3, 3.5);
      pip(g, p.x, p.y, 1.2);
    }
    bolt({ ...ctx, x: drum.x, y: drum.y }, 1.6);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A four-tube missile pod on a turntable with a search radar spinning at its rear; warhead noses return as it reloads.
  battery: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "battery"),
      sides = MUZZLES.battery!.sides!;
    boss(g, x, y, 10, shade(c, -0.55));
    // Pod housing under the tubes, with its cast shadow.
    strip(g, x + 0.6, y + 1, ca, sa, back - 6, end - 4, -8, 8, -8, 8, SHADOW, 0.45);
    block(g, x, y, a, 8, 8.2, 2, shade(c, -0.5));
    for (const side of sides) litBar(g, x, y, a, back - 2, end, 1.6, 1.6, shade(c, -0.1), { side, tip, bands: level >= 3 ? [0.5] : undefined });
    // Warhead noses in the mouths, one per quarter of the reload.
    sides.forEach((side, i) => {
      const p = point(x, y, ca, sa, end - 1.2, side);
      disc(g, p.x, p.y, 1.3, OUTLINE);
      if (charge >= 0.25 * (i + 1)) disc(g, p.x - 0.2, p.y - 0.2, 0.9, shade(c, 0.45));
    });
    // Search radar: a dish turning on the rear of the pod.
    const r = point(x, y, ca, sa, -8.5, 0),
      spin = clock * 3 + t.id;
    disc(g, r.x, r.y, 3.6, OUTLINE);
    oval(g, r.x, r.y, 3.2, 1.2 + 1.8 * Math.abs(Math.cos(spin)), shade(c, 0.15), 1, spin);
    disc(g, r.x, r.y, 0.9, shade(c, -0.4));
    if (level >= 2) disc(glow, r.x, r.y, 2.6, c, 0.12 + 0.1 * Math.max(0, Math.sin(spin * 2)));
    bolt(ctx, 2);
    muzzleGlow(ctx, end + 1.5, 6);
  },
  // A round-bottomed flask: its neck is the barrel, the reagent inside rises with the charge and bubbles; a
  // copper coil wraps the neck from level 3.
  flask: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy, maxed } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "flask");
    litBar(g, x, y, a, back + 5, end, 2.8, 2.4, shade(c, -0.55), { tip, bands: level >= 3 ? [0.35, 0.55, 0.75] : undefined });
    litBar(g, x, y, a, back + 6, end - 1, 1.6, 1.3, shade(c, -0.1), { shadow: false });
    disc(g, x + 1, y + 1.6, 10.6, SHADOW, 0.4);
    disc(g, x, y, 10.4, shade(c, -0.6));
    disc(g, x, y, 9.2, shade(DARK, 0.15));
    // Reagent level: a chord that rises with the charge, drawn as a wedge from below.
    const fill = 0.25 + 0.75 * charge,
      spread = Math.acos(1 - 2 * fill);
    wedge(g, x, y, 8.6, Math.PI / 2 - spread, Math.PI / 2 + spread, c, 0.9);
    disc(g, x, y + 8.6 * (1 - fill) * 0.4, 8.6 * Math.sqrt(fill) * 0.7, c, 0.75);
    disc(glow, x, y, 9, c, Math.min(0.3, 0.08 + 0.14 * charge + energy));
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 1.1 + i / 3 + t.id * 0.27) % 1;
      disc(g, x - 3 + i * 3, y + 6 - phase * 10 * fill, 1.1, shade(c, 0.6), (1 - phase) * 0.9);
    }
    arcBand(g, x, y, 8.2, 1.6, LIGHT - 0.7, LIGHT + 0.6, 0xffffff, 0.4);
    disc(g, x - 3.4, y - 3.6, 1.2, 0xffffff, 0.7);
    if (kick > 0) ring(glow, x, y, 10 + (1 - kick) * 6, 1.4, shade(c, 0.4), 0.3 * kick);
    if (maxed) bolt(ctx, 1.4);
    muzzleGlow(ctx, end + 1.5, 4);
  },
  // The lens glows brighter with every consecutive hit on the locked target; a gauge around the core shows the heat.
  lens: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      heat = Math.min(1, (t.focus?.stacks ?? 0) / 10),
      { end } = reach(ctx, "lens");
    ring(g, x, y, 11, 1.6, OUTLINE, 0.7);
    if (heat > 0) arcBand(g, x, y, 11, 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * heat, c);
    litBar(g, x, y, a, 2, end, 4.5, 2.2, shade(c, -0.45), { bands: level >= 3 ? [0.45, 0.6] : undefined, tip });
    bar(g, x, y, a, 4, end - 1.5, 1.4, 1, c, 0.4 + 0.6 * heat);
    bar(glow, x, y, a, 4, end - 1.5, 1.6, 1.2, c, Math.min(0.5, 0.1 + 0.3 * heat + energy));
    const lens = at(x, y, a, end - 0.5);
    disc(g, lens.x, lens.y, 1.9, shade(c, 0.45));
    glowDot(glow, lens.x, lens.y, 5, c, Math.min(0.6, 0.15 + 0.35 * Math.max(heat, kick) + energy));
    boss(g, x, y, 9, shade(c, -0.55));
    disc(g, x, y, 4 + 3 * heat, c, 0.35 + 0.65 * heat);
    disc(glow, x, y, 5 + 3 * heat, c, 0.1 + 0.25 * heat);
    bolt(ctx, 1.5);
  },
  // A three-facet prism with a void core hovers over its shadow; motes spiral into it.
  prism: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, maxed, energy } = ctx,
      c = d.color,
      spin = clock * 0.6 + t.id,
      lift = Math.sin(clock * 2 + t.id) * 1.5,
      cy = y - lift;
    polygon(g, x + 2, y + 4, 10.5 - 0.4 * lift, 3, SHADOW, spin, 0.35 - 0.04 * lift);
    disc(glow, x, cy, 13, c, 0.05 + 0.1 * charge + energy * 0.5);
    polygon(g, x, cy, 11.5, 3, shade(c, -0.55), spin);
    facets(g, x, cy, 10.2, 3, spin, c, 0.45);
    polygon(g, x, cy, 3.8, 3, maxed ? 0xffffff : shade(c, -0.6), -spin);
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.5 + i / 3 + t.id * 0.11) % 1,
        p = at(x, cy, -clock * 1.2 + t.id + (i * TAU) / 3 + phase * 2.4, 16 - phase * 12);
      disc(glow, p.x, p.y, 1.6, shade(c, 0.4), 0.3 * Math.min(1, phase * 3));
    }
    // Orbiting shards from level 3.
    if (level >= 3) {
      g.fillStyle(shade(c, 0.2));
      for (let i = 0; i < 3; i++) {
        const s = at(x, cy, -spin * 1.4 + (i * TAU) / 3, 15),
          p0 = at(s.x, s.y, spin, 2.2),
          p1 = at(s.x, s.y, spin + TAU / 3, 2.2),
          p2 = at(s.x, s.y, spin - TAU / 3, 2.2);
        g.fillTriangle(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
      }
    }
    if (kick > 0) ring(glow, x, cy, 11 + (1 - kick) * 7, 1.5, 0xffffff, 0.35 * kick);
  },
  // A satellite dish on a yoke tracks the target, a designator laser along its feed arm. A countdown arc on the deck
  // fills with the charge, and the red beacon on the dish blinks faster as the next strike nears.
  uplink: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "uplink");
    arcBand(g, x, y, 15.6, 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * charge, shade(c, -0.1), 0.75);
    if (charge >= 1) ring(glow, x, y, 15.6, 2, c, 0.1 + 0.06 * Math.sin(clock * 6 + t.id));
    boss(g, x, y, 8.5, shade(c, -0.62));
    litBar(g, x, y, a, back, end, 1.9, 1.3, shade(PLATE, 0.1), { tip, bands: level >= 3 ? [0.55, 0.7] : [0.6] });
    bar(glow, x, y, a, back + 4, end, 0.6, 0.5, c, Math.min(0.4, 0.1 + 0.25 * charge + energy));
    // The dish: an oval across the aim behind the centre, its bowl lit on the side that faces the light.
    const dx = x - ca * (3 + kick * 1.5),
      dy = y - sa * (3 + kick * 1.5);
    oval(g, dx + 0.8, dy + 1.4, 5.2, 12.6, SHADOW, 0.4, a);
    oval(g, dx, dy, 5, 12.2, shade(PLATE, -0.3), 1, a);
    oval(g, dx + ca * 1.2, dy + sa * 1.2, 3.8, 10.8, shade(PLATE, 0.2 + 0.15 * facing(a)), 1, a);
    oval(g, dx + ca * 1.9, dy + sa * 1.9, 2.4, 8.4, shade(c, -0.6), 1, a);
    g.fillStyle(OUTLINE, 0.8);
    for (const side of [-7, 0, 7]) {
      const p = point(dx, dy, ca, sa, 1.2, side);
      pip(g, p.x, p.y, 0.8);
    }
    // Struts to the feed horn at the focus.
    g.lineStyle(0.9, shade(PLATE, 0.3), 0.9);
    for (const side of [-8, 8]) {
      const p = point(dx, dy, ca, sa, 1.6, side),
        q = point(x, y, ca, sa, 4, 0);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
    const horn = point(x, y, ca, sa, 4, 0);
    disc(g, horn.x, horn.y, 2.2, shade(PLATE, 0.35));
    disc(g, horn.x, horn.y, 1.1, c);
    const beacon = point(dx, dy, ca, sa, -2.4, 0),
      blink = Math.sin(clock * (3 + 9 * charge) + t.id) > 0.3 ? 1 : 0.15;
    led(ctx, beacon.x, beacon.y, c, blink);
    if (kick > 0) halo(glow, horn.x, horn.y, 8 * (0.5 + kick), c, 0.3 * kick);
    muzzleGlow(ctx, end + 1, 4);
  },
} satisfies Partial<Record<TurretStyle, Drawing>>;
