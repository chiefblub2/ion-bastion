import type { TurretStyle } from "../../core/types";
import { DARK, LIGHT, OUTLINE, PLATE, SHADOW, dome, facing, glowLine, halo, litBar } from "../material";
import { MUZZLES } from "../muzzles";
import { arcBand, chamferRect, disc, hash01, oval, polygon, ring, shade, star, strip, wedge } from "../shapes";
import { type Drawing, TAU, PTS, put, at, point, quad, tick, pip, fins, loop, block, facets, boss, glowDot, reach, bolt, muzzleGlow, hexLine } from "./kit";
/** Turret drawings of the Control tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. */
export const CONTROL_TURRETS = {
  // An ice crystal of four facets, re-lit as it spins so its highlight stays on the upper left; motes drift away.
  crystal: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, maxed, energy } = ctx,
      c = d.color,
      spin = clock * 0.8 + t.id;
    disc(glow, x, y, 13 + 2 * charge, c, 0.05 + 0.07 * charge + energy * 0.5);
    polygon(g, x, y, 11.5, 4, shade(c, -0.6), spin);
    facets(g, x, y, 10, 4, spin, c, 0.5);
    polygon(g, x, y, 3.6, 4, maxed ? 0xffffff : shade(c, 0.45), spin);
    disc(glow, x, y, 5, c, Math.min(0.45, 0.12 + 0.13 * charge + energy));
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.45 + i / 3 + t.id * 0.13) % 1,
        p = at(x, y, t.id + i * 2.1 + phase * 0.5, 9 + phase * 11);
      polygon(g, p.x, p.y, 1.4, 4, shade(c, 0.6), spin * 2, 1 - phase);
    }
    // Orbiting shards from level 3.
    if (level >= 3) {
      g.fillStyle(shade(c, 0.2));
      for (let i = 0; i < 2; i++) {
        const s = at(x, y, -spin * 1.5 + i * Math.PI, 15),
          ca = Math.cos(spin),
          sa = Math.sin(spin);
        g.fillTriangle(s.x - ca * 2.5, s.y - sa * 2.5, s.x - sa * 2.5, s.y + ca * 2.5, s.x + ca * 2.5, s.y + sa * 2.5);
        g.fillTriangle(s.x - ca * 2.5, s.y - sa * 2.5, s.x + sa * 2.5, s.y - ca * 2.5, s.x + ca * 2.5, s.y + sa * 2.5);
      }
    }
    if (kick > 0) ring(glow, x, y, 12 + (1 - kick) * 6, 1.5, 0xffffff, 0.35 * kick);
  },
  // A lattice mast with a glowing tip ball; signal rings radiate while it charges and glitch pixels flicker around it.
  antenna: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy } = ctx,
      c = d.color;
    g.lineStyle(1.3, shade(c, -0.35));
    g.beginPath();
    g.moveTo(x - 2.4, y + 8);
    g.lineTo(x - 0.9, y - 12);
    g.moveTo(x + 2.4, y + 8);
    g.lineTo(x + 0.9, y - 12);
    g.strokePath();
    for (let k = 0; k <= 5; k++) put(k, x + (k % 2 ? 1.6 : -1.6) * (1 - k * 0.1), y + 8 - k * 4);
    g.lineStyle(0.8, shade(c, -0.5));
    g.strokePoints(PTS, false, false, 6);
    litBar(g, x, y - 4, 0, -6.5, 6.5, 1, 1, shade(c, -0.3));
    for (let i = 0; i < (level >= 3 ? 3 : 2); i++) {
      const phase = (clock * (0.6 + charge) + i / 3) % 1;
      arcBand(glow, x, y - 12, 4 + phase * 9, 1.5, -Math.PI * 0.85, -Math.PI * 0.15, c, (1 - phase) * Math.min(0.5, 0.15 + 0.25 * charge + energy));
    }
    glowDot(glow, x, y - 12, 6, c, Math.min(0.5, 0.2 + 0.25 * charge + energy));
    disc(g, x, y - 12, 2.6, c);
    disc(g, x - 0.8, y - 12.8, 0.9, 0xffffff, 0.8);
    // Glitch pixels, re-rolled 20 times a second.
    const seed = Math.floor(clock * 20) + t.id * 97;
    for (let i = 0; i < 4; i++) {
      g.fillStyle(hash01(seed, i, 3) < 0.3 ? 0xffffff : c, 0.85);
      g.fillRect(x - 12 + hash01(seed, i, 1) * 24, y - 16 + hash01(seed, i, 2) * 24, 1.6, 1.6);
    }
    if (kick > 0) ring(glow, x, y, 8 + (1 - kick) * 14, 2, shade(c, 0.5), 0.35 * kick);
  },
  // A twin-tube net launcher with a hatched net pack at the rear; weights wait in the mouth once loaded.
  launcher: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "launcher");
    strip(g, x + 0.6, y + 1, ca, sa, -12.5, -3.5, -6.5, 6.5, -6.5, 6.5, SHADOW, 0.45);
    strip(g, x, y, ca, sa, -12.5, -3.5, -6.5, 6.5, -6.5, 6.5, shade(c, -0.45));
    g.lineStyle(0.8, shade(c, 0.05), 0.9);
    g.beginPath();
    for (const dir of [-1, 1])
      for (let k = 0; k <= 4; k++) {
        const p = point(x, y, ca, sa, -12 + k * 2, dir * (k % 2 ? 6 : -6));
        if (k) g.lineTo(p.x, p.y);
        else g.moveTo(p.x, p.y);
      }
    g.strokePath();
    boss(g, x, y, 10, shade(c, -0.55));
    for (const side of MUZZLES.launcher!.sides!) litBar(g, x, y, a, back, end, 2.6, 3.2, shade(c, -0.15), { side, tip, bands: level >= 3 ? [0.45, 0.6] : undefined });
    const mouth = at(x, y, a, end);
    ring(g, mouth.x, mouth.y, 5, 1.1, c, 0.8);
    if (charge > 0.7) {
      g.fillStyle(shade(c, -0.25));
      for (let k = 0; k < 4; k++) {
        const p = at(mouth.x, mouth.y, a + Math.PI / 4 + (k * Math.PI) / 2, 5);
        pip(g, p.x, p.y, 1.3);
      }
    }
    bolt(ctx, 2);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A short wide-bore launcher: a plasma canister glows in the breech once loaded, coils ring the tube, and the
  // bore spills light after a shot.
  caster: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "caster");
    boss(g, x, y, 11.5, shade(c, -0.6));
    litBar(g, x, y, a, back - 4, end, 6, 6.8, shade(c, -0.45), { tip });
    // Field coils around the tube; they light up as the canister charges.
    const coils = level >= 3 ? [0.35, 0.55, 0.75] : [0.45, 0.7];
    for (const f of coils) {
      const dd = back - 4 + (end - back + 4) * f;
      strip(g, x, y, ca, sa, dd - 1, dd + 1, -7.6, 7.6, -7.6, 7.6, shade(c, -0.15));
      strip(glow, x, y, ca, sa, dd - 0.6, dd + 0.6, -7, 7, -7, 7, c, Math.min(0.3, 0.06 + 0.2 * charge + energy));
    }
    const mouth = point(x, y, ca, sa, end - 3.5, 0);
    disc(g, mouth.x, mouth.y, 4.6, OUTLINE);
    if (charge > 0.8) {
      disc(g, mouth.x, mouth.y, 3, shade(c, 0.25));
      disc(glow, mouth.x, mouth.y, 4.4, c, 0.25 * (charge - 0.8) * 5);
    }
    if (kick > 0) halo(glow, mouth.x, mouth.y, 9 * (0.6 + kick), c, 0.3 * kick);
    bolt(ctx, 2.4);
    muzzleGlow(ctx, end + 1, 6);
  },
  // Rings collapse towards a black core while charging, thickening as they shrink; masses orbit with light trails.
  gravity: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy, peak } = ctx,
      c = d.color;
    for (let i = 0; i < 2 + (level >= 3 ? 1 : 0); i++) {
      const r = Math.max(4, 15 - ((charge * 10 + i * 4) % 11));
      loop(g, x, y, r, 1 + (15 - r) * 0.16, c, 0.25 + 0.6 * charge);
    }
    const spin = -clock * (0.8 + charge) + t.id;
    for (let i = 0; i < 3; i++) {
      const b = spin + (i * TAU) / 3;
      arcBand(glow, x, y, 11, 1.4, b, b + 0.6, c, 0.22);
    }
    g.fillStyle(shade(c, 0.35));
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, spin + (i * TAU) / 3, 11);
      pip(g, p.x, p.y, 1.8);
    }
    disc(g, x, y, 5.5, 0x05070f);
    loop(g, x, y, 5.6, 0.7, shade(c, 0.3), 0.5 + 0.4 * charge);
    loop(glow, x, y, 6, 1.8, c, Math.min(peak, 0.2 + 0.25 * charge + energy));
    if (kick > 0) ring(glow, x, y, 8 + (1 - kick) * 14, 2, shade(c, 0.5), 0.35 * kick);
  },
  // Three turning arms with glowing tips around a hex core; a hex dial's hand sweeps round with the charge.
  emitter: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy } = ctx,
      c = d.color,
      arms = [0, 1, 2].map((i) => clock * 0.4 + t.id + (i * TAU) / 3);
    fins(g, x, y, arms, 6, 13, 2.4, 1, c);
    glow.fillStyle(c, Math.min(0.5, 0.15 + 0.3 * charge + energy));
    for (const b of arms) pip(glow, x + Math.cos(b) * 13, y + Math.sin(b) * 13, 2.6);
    hexLine(g, x, y, 10, 1.5, c, 0.3 + 0.6 * charge, Math.PI / 6);
    if (level >= 3) hexLine(g, x, y, 12.5, 1, c, 0.25 + 0.5 * charge, Math.PI / 6);
    const hand = at(x, y, -Math.PI / 2 + TAU * charge, 9.5);
    g.lineStyle(1.6, shade(c, 0.45), 0.95);
    g.lineBetween(x, y, hand.x, hand.y);
    polygon(g, x, y, 5.5, 6, shade(c, -0.5), Math.PI / 6);
    polygon(g, x - 0.4, y - 0.4, 4.3, 6, c, Math.PI / 6, 0.45 + 0.55 * charge);
    disc(glow, x, y, 6.5, c, Math.min(0.5, 0.12 + 0.2 * charge + energy));
    if (kick > 0) hexLine(glow, x, y, 8 + (1 - kick) * 12, 2, shade(c, 0.5), 0.35 * kick, Math.PI / 6);
  },
  // A glass tank of acid with rising bubbles; a drip at the nozzle grows with the charge and falls on a shot.
  vat: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, charge, clock, maxed, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "vat");
    litBar(g, x, y, a, back + 4, end - 3, 2.6, 2.2, shade(c, -0.35), { bands: level >= 3 ? [0.4, 0.6] : undefined });
    litBar(g, x, y, a, end - 3, end, 3.4, 3.4, shade(c, -0.1), { tip });
    const drip = at(x, y, a, end + 1);
    disc(g, drip.x, drip.y, 0.8 + 1.2 * charge, c);
    if (kick > 0) disc(g, drip.x, drip.y + (1 - kick) * 7, 2, c, kick);
    boss(g, x, y, 10, shade(c, -0.6));
    disc(g, x, y, 7.5, c, 0.85);
    disc(glow, x, y, 8, c, 0.12 + energy);
    for (let i = 0; i < 2; i++) {
      const phase = (clock * 0.9 + i * 0.5 + t.id * 0.3) % 1;
      disc(g, x - 2 + i * 4, y + 3 - phase * 7, 1.3, shade(c, 0.6), 1 - phase);
    }
    arcBand(g, x, y, 5.6, 1.6, LIGHT - 0.7, LIGHT + 0.7, 0xffffff, 0.35);
    if (maxed) bolt(ctx, 1.5);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A hypnotic disc: spiral arms in violet on black turn ever faster with the charge round an eye that follows the
  // target; a short emitter prong points at it. A third arm joins from level 3.
  spiral: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "spiral"),
      arms = level >= 3 ? 3 : 2,
      spin = clock * (1.2 + 3 * charge) + t.id;
    litBar(g, x, y, a, back + 6, end, 2.4, 1.2, shade(c, -0.55), { tip });
    disc(g, x + 1, y + 1.6, 11.6, SHADOW, 0.4);
    disc(g, x, y, 11.4, OUTLINE);
    disc(g, x, y, 10.4, shade(c, -0.72));
    for (const [ink, w, alpha] of [[glow, 3.4, Math.min(0.3, 0.08 + 0.15 * charge + energy)], [g, 1.8, 0.95]] as const) {
      ink.lineStyle(w, c, alpha);
      for (let i = 0; i < arms; i++) {
        for (let k = 0; k < 12; k++) {
          const b = spin + (i * TAU) / arms + k * 0.42,
            r = 1.6 + k * 0.74;
          put(k, x + Math.cos(b) * r, y + Math.sin(b) * r);
        }
        ink.strokePoints(PTS, false, false, 12);
      }
    }
    arcBand(g, x, y, 10.6, 0.9, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.35), 0.7);
    // The eye looks along the aim.
    oval(g, x, y, 2.6, 4, shade(c, 0.75), 1, a);
    const pupil = at(x, y, a, 0.9);
    disc(g, pupil.x, pupil.y, 1.5, OUTLINE);
    glowDot(glow, x, y, 6, c, Math.min(peak, 0.15 + 0.3 * charge + energy));
    if (kick > 0) ring(glow, x, y, 11 + (1 - kick) * 9, 1.6, shade(c, 0.4), 0.3 * kick);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A faceted amber gem in a three-claw clamp, glowing deeper as the resin gathers; the nozzle in front drips with the
  // charge. A fossil insect hangs in the gem from level 3.
  resin: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "resin");
    litBar(g, x, y, a, back + 4, end, 3.2, 2.4, shade(PLATE, -0.1), { tip, bands: level >= 3 ? [0.5, 0.75] : [0.65] });
    if (charge > 0.5) {
      const drip = point(x, y, ca, sa, end - 0.5, 0);
      disc(g, drip.x, drip.y + (charge - 0.5) * 4, 0.8 + 1.6 * (charge - 0.5), shade(c, 0.15), 0.95);
    }
    fins(g, x, y, [a + Math.PI, a + Math.PI / 3, a - Math.PI / 3], 6.5, 12.5, 2.6, 1.2, shade(PLATE, 0.05));
    disc(g, x + 1, y + 1.6, 9.8, SHADOW, 0.35);
    polygon(g, x, y, 10, 6, OUTLINE, a + Math.PI / 6, 0.9);
    facets(g, x, y, 9, 6, a + Math.PI / 6, shade(c, -0.2), 0.42);
    polygon(g, x, y, 5.4, 6, shade(c, 0.3), a + Math.PI / 6, 0.45 + 0.45 * charge);
    if (level >= 3) {
      oval(g, x + 1.4, y + 1.2, 1.9, 0.9, shade(c, -0.75), 0.85, t.id);
      g.lineStyle(0.5, shade(c, -0.75), 0.7);
      g.lineBetween(x + 0.2, y + 0.2, x + 2.6, y + 2.4);
    }
    disc(glow, x, y, 8, c, Math.min(peak * 0.5, 0.08 + 0.18 * charge + energy));
    disc(g, x - 3, y - 3.4, 1.2, 0xffffff, 0.7);
    if (kick > 0) halo(glow, x, y, 10 * (0.6 + kick), c, 0.3 * kick);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A horseshoe magnet turned at the target: two pole arms wound with copper on a steel yoke. Field lines arc between
  // the bright pole tips, more of them as the pulse charges, and a ring snaps away from the poles on a pulse.
  magnet: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      len = 12 + Math.min(level, 5) * 0.5,
      yoke = point(x, y, ca, sa, -3, 0),
      lines = 1 + Math.round(charge * (level >= 3 ? 3 : 2));
    for (let i = 0; i < lines; i++) {
      const bulge = 3.5 + i * 2.8 + Math.sin(clock * 4 + i + t.id) * 0.6;
      for (let k = 0; k <= 8; k++) {
        const u = k / 8,
          p = point(x, y, ca, sa, len + Math.sin(Math.PI * u) * bulge, (u * 2 - 1) * 5.5);
        put(k, p.x, p.y);
      }
      glow.lineStyle(1.2, c, Math.min(0.35, 0.1 + 0.2 * charge + energy) * (1 - i * 0.18));
      glow.strokePoints(PTS, false, false, 9);
    }
    arcBand(g, yoke.x + 0.8, yoke.y + 1.2, 5.5, 3.8, a + Math.PI / 2, a + 1.5 * Math.PI, SHADOW, 0.4);
    arcBand(g, yoke.x, yoke.y, 5.5, 3.8, a + Math.PI / 2, a + 1.5 * Math.PI, shade(PLATE, 0.1));
    arcBand(g, yoke.x, yoke.y, 6.6, 1, a + Math.PI / 2, a + 1.5 * Math.PI, shade(PLATE, 0.45), 0.6);
    for (const side of [-5.5, 5.5]) litBar(g, x, y, a, -3, len, 1.9, 1.9, shade(c, -0.25), { side, bands: [0.3, 0.42, 0.54] });
    g.fillStyle(0xb8743a);
    for (const side of [-5.5, 5.5])
      for (const f of [0.3, 0.42, 0.54]) {
        const p = point(x, y, ca, sa, -3 + (len + 3) * f, side);
        pip(g, p.x, p.y, 1.2);
      }
    for (const side of [-5.5, 5.5]) {
      const p = point(x, y, ca, sa, len, side);
      disc(g, p.x, p.y, 2.1, tip ?? shade(PLATE, 0.55));
      glowDot(glow, p.x, p.y, 3.6, c, Math.min(peak, 0.12 + 0.3 * charge + energy));
    }
    boss(g, x, y, 3.6, shade(c, -0.5));
    if (kick > 0) {
      const q = point(x, y, ca, sa, len + 3, 0);
      ring(glow, q.x, q.y, 3 + (1 - kick) * 10, 1.6, shade(c, 0.5), 0.35 * kick);
    }
  },
  // A ducted fan: a round shroud with swept blades that spin up as the gust charges and blur after a blast, a domed
  // hub, and wind streaks curling round the rim in light. Six blades from level 3.
  fan: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, energy, peak } = ctx,
      c = d.color,
      blades = level >= 3 ? 6 : 5,
      spin = clock * (1.5 + 6 * charge) + kick * 4 + t.id;
    disc(g, x + 1, y + 1.6, 13, SHADOW, 0.4);
    ring(g, x, y, 12.4, 3, OUTLINE, 0.9);
    ring(g, x, y, 12, 1.8, shade(PLATE, 0.05));
    arcBand(g, x, y, 12.2, 1, LIGHT - 1, LIGHT + 1, shade(PLATE, 0.5), 0.8);
    disc(g, x, y, 10.6, shade(DARK, -0.25));
    for (let i = 0; i < blades; i++) {
      const b = spin + (i * TAU) / blades;
      g.fillStyle(shade(c, -0.15 + 0.3 * facing(b + Math.PI / 2)));
      quad(g, x, y, Math.cos(b), Math.sin(b), 3, 10.2, -1.1, 1.5, 0.4, 3.6);
    }
    if (charge > 0.6 || kick > 0) ring(glow, x, y, 7, 6, c, Math.min(0.25, 0.1 * charge + 0.2 * kick + energy));
    dome(g, x, y, 3.4, shade(c, -0.25));
    for (let i = 0; i < 3; i++) {
      const s = clock * (2 + 2 * charge) + (i * TAU) / 3 + t.id;
      arcBand(glow, x, y, 15.2, 1, s, s + 0.7, c, Math.min(peak * 0.5, 0.08 + 0.15 * charge + energy));
    }
    if (kick > 0) ring(glow, x, y, 12 + (1 - kick) * 12, 2, shade(c, 0.5), 0.3 * kick);
  },
  // A grapple gun: a winch drum with wound chain at the rear, a barrel with a three-pronged claw that flies off on a
  // shot and is wound back in as the grapple reloads; the chain between drum and claw lights up from level 3.
  tether: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, clock } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "tether");
    boss(g, x, y, 10.5, shade(c, -0.6));
    // Winch drum across the rear, turning while it winds the chain back in.
    const drum = point(x, y, ca, sa, -7.5, 0);
    block(g, drum.x + 0.6, drum.y + 1, a, 3.4, 8.4, 1.2, SHADOW);
    block(g, drum.x, drum.y, a, 3.4, 8.4, 1.2, shade(c, -0.45));
    const turn = (charge < 1 ? clock * 9 : 0) + t.id;
    g.fillStyle(shade(c, 0.2));
    for (let k = -3; k <= 3; k++) {
      const wobble = 0.6 * Math.sin(turn + k * 1.7),
        p = point(drum.x, drum.y, ca, sa, wobble, k * 2.2);
      pip(g, p.x, p.y, 1);
    }
    litBar(g, x, y, a, back - 2, end - 3, 2.8, 2.4, shade(c, -0.25), { tip, bands: level >= 3 ? [0.4, 0.62] : undefined });
    // The claw: three prongs at the tip once wound back in, absent right after a shot.
    const home = Math.min(1, Math.max(0, (charge - 0.35) / 0.4));
    if (home > 0) {
      const claw = point(x, y, ca, sa, end - 3 + (1 - home) * -6, 0);
      disc(g, claw.x, claw.y, 2.3, shade(c, -0.5), home);
      for (const off of [-0.85, 0, 0.85]) {
        const b = a + off,
          p = at(claw.x, claw.y, b, 4.8);
        g.lineStyle(1.4, shade(c, 0.3), home);
        g.lineBetween(claw.x, claw.y, p.x, p.y);
        disc(g, p.x, p.y, 0.8, shade(c, 0.55), home);
      }
    }
    // Chain links along the barrel from the drum: they light up one by one as the claw comes home.
    const links = 5;
    for (let i = 0; i < links; i++) {
      const f = i / (links - 1),
        p = point(x, y, ca, sa, -4 + f * (end - 6), 0);
      if (i % 2) chamferRect(g, p.x, p.y, 1.1, 1.1, 0.4, shade(c, 0.15));
      else ring(g, p.x, p.y, 1.4, 0.8, shade(c, 0.35));
      if (level >= 3 && f <= home) disc(glow, p.x, p.y, 2.2, c, Math.min(0.3, 0.1 + 0.12 * home + energy));
    }
    bolt(ctx, 2.2);
    muzzleGlow(ctx, end + 1, 4);
    if (kick > 0) glowLine(glow, x, y, x + ca * (end + 10 * (1 - kick)), y + sa * (end + 10 * (1 - kick)), c, 1.2, 0.3 * kick);
  },
  // A classic ray gun: a stepped cone of rings narrowing to a lens; pulses of light run down the cone and shrink
  // as the next beam builds, and the lens brightens with the charge.
  shrinker: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, clock, maxed } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "shrinker");
    boss(g, x, y, 10, shade(c, -0.6));
    // The cone: a tapered body and three collar rings, each narrower than the last.
    litBar(g, x, y, a, back - 3, end - 2, 6.2, 2.2, shade(c, -0.5), { tip });
    const collars = level >= 3 ? [0.2, 0.42, 0.64, 0.84] : [0.25, 0.55, 0.82];
    for (const f of collars) {
      const dd = back - 3 + (end - 2 - back + 3) * f,
        w = 6.2 + (2.2 - 6.2) * f + 1.2;
      strip(g, x, y, ca, sa, dd - 0.9, dd + 0.9, -w, w, -w, w, shade(c, -0.15));
      strip(g, x, y, ca, sa, dd - 0.9, dd - 0.2, -w, w, -w, w, shade(c, 0.35), 0.8);
    }
    // Light pulses travelling to the lens, shrinking on their way.
    for (let i = 0; i < 2; i++) {
      const k = (clock * (0.8 + charge) + i / 2 + t.id * 0.17) % 1,
        dd = back - 2 + (end - back) * k,
        w = 5.6 * (1 - 0.7 * k);
      strip(glow, x, y, ca, sa, dd - 0.6, dd + 0.6, -w, w, -w, w, c, Math.min(0.3, (0.08 + 0.18 * charge + energy) * (1 - k * 0.5)));
    }
    const lens = point(x, y, ca, sa, end - 1, 0);
    disc(g, lens.x, lens.y, 2.4, OUTLINE);
    disc(g, lens.x, lens.y, 1.7, shade(c, -0.3 + 0.7 * charge));
    disc(g, lens.x - 0.5, lens.y - 0.5, 0.6, 0xffffff, 0.4 + 0.5 * charge);
    glowDot(glow, lens.x, lens.y, 5, c, Math.min(0.5, 0.1 + 0.3 * Math.max(charge * charge, kick) + energy));
    // Gauge on the housing: a ring segment that closes with the charge.
    if (charge > 0.02) arcBand(g, x, y, 8.2, 1.2, a + Math.PI - Math.PI * 0.6 * charge, a + Math.PI + Math.PI * 0.6 * charge, c, 0.85);
    if (maxed) bolt(ctx, 1.6);
    else bolt(ctx, 2);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A turning pentagram floats over the plate; its points kindle with the charge, and a cursed shard grows in the
  // point that faces the target. Rune marks orbit it from level 3.
  sigil: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, clock, energy, peak, maxed } = ctx,
      a = t.angle,
      c = d.color,
      lift = Math.sin(clock * 2.2 + t.id) * 1.2,
      cy = y - lift,
      { end } = reach(ctx, "sigil");
    oval(g, x + 1.5, y + 3, 11 - 0.3 * lift, 7, SHADOW, 0.35);
    // Star: one point on the aim, so the shard forms there.
    star(g, x, cy, 13, 5.4, 5, shade(c, -0.55), a);
    star(g, x - 0.4, cy - 0.4, 11.6, 4.6, 5, shade(c, -0.15 + 0.2 * charge), a);
    for (let i = 0; i < 5; i++) {
      const p = at(x, cy, a + (i * TAU) / 5, 11),
        on = Math.max(0, Math.min(1, charge * 5 - ((i + 4) % 5)));
      if (on > 0) disc(glow, p.x, p.y, 3, c, Math.min(0.3, 0.25 * on + energy * 0.5));
    }
    // Inner pentagon, engraved.
    for (let i = 0; i < 5; i++) put(i, x + Math.cos(a + Math.PI + (i * TAU) / 5) * 4.4, cy + Math.sin(a + Math.PI + (i * TAU) / 5) * 4.4);
    g.lineStyle(0.9, shade(c, 0.4), 0.7);
    g.strokePoints(PTS, true, true, 5);
    // The cursed shard at the leading point, growing with the charge, gone right after a shot.
    const grow = Math.max(0, (charge - 0.3) / 0.7) * (1 - kick);
    if (grow > 0) {
      const p = at(x, cy, a, end - 2),
        hl = 3.6 * grow,
        hw = 1.6 * grow;
      block(g, p.x, p.y, a, hl, hw, hw * 0.9, shade(c, 0.35));
      block(g, p.x - 0.3, p.y - 0.3, a, hl * 0.6, hw * 0.5, hw * 0.4, 0xffffff);
      glowDot(glow, p.x, p.y, 5, c, Math.min(peak, 0.15 + 0.3 * grow + energy));
    }
    if (level >= 3) {
      g.fillStyle(shade(c, 0.3), 0.8);
      for (let i = 0; i < 3; i++) {
        const p = at(x, cy, -clock * 0.9 + t.id + (i * TAU) / 3, 16);
        tick(g, p.x, p.y, -clock * 0.9 + (i * TAU) / 3, -1.6, 1.6, 1.1);
      }
    }
    disc(g, x, cy, 2.6, maxed ? shade(c, 0.8) : DARK);
    disc(glow, x, cy, 4, c, Math.min(peak, 0.12 + 0.2 * charge + energy));
    if (kick > 0) ring(glow, x, cy, 9 + (1 - kick) * 9, 1.6, shade(c, 0.4), 0.32 * kick);
  },
  // A flared drain nozzle feeding a glass reservoir: the drained fluid swirls in it and sinks as the beam reloads,
  // and three feed lines carry it out to the towers around (lit from level 3).
  siphon: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, clock, maxed } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "siphon");
    // Feed lines from the reservoir to the plate rim, opposite the nozzle.
    for (const off of [-0.9, 0, 0.9]) {
      const b = a + Math.PI + off,
        flow = (clock * 1.4 + off + t.id * 0.3) % 1;
      litBar(g, x, y, b, 7, 15, 1.2, 1.2, shade(c, -0.45), { shadow: false });
      if (level >= 3) {
        const p = at(x, y, b, 7 + 8 * flow);
        disc(glow, p.x, p.y, 2, c, Math.min(0.3, 0.12 + energy) * (1 - flow));
      }
    }
    // The nozzle: wide mouth, narrow neck.
    litBar(g, x, y, a, back + 4, end, 1.8, 4.6, shade(c, -0.4), { tip, bands: level >= 3 ? [0.5] : undefined });
    const mouth = point(x, y, ca, sa, end - 0.8, 0);
    strip(g, x, y, ca, sa, end - 1.6, end, -4.2, 4.2, -4.2, 4.2, OUTLINE, 0.9);
    strip(glow, x, y, ca, sa, end - 1.4, end, -3.6, 3.6, -3.6, 3.6, c, Math.min(0.3, 0.06 + 0.2 * Math.max(kick, charge * 0.5) + energy));
    // Reservoir: a glass bulb whose fluid level falls after a drain shot and rises back.
    disc(g, x + 0.8, y + 1.2, 9.6, SHADOW, 0.4);
    disc(g, x, y, 9.4, shade(c, -0.65));
    disc(g, x, y, 8.2, shade(DARK, 0.15));
    const fill = 0.3 + 0.6 * charge,
      spread = Math.acos(1 - 2 * fill);
    wedge(g, x, y, 7.6, Math.PI / 2 - spread, Math.PI / 2 + spread, c, 0.85);
    // A swirl in the fluid.
    const swirl = clock * 2.4 + t.id;
    arcBand(g, x, y, 4.2, 1.1, swirl, swirl + 2, shade(c, 0.5), 0.7);
    arcBand(g, x, y, 2.2, 0.9, -swirl * 1.3, -swirl * 1.3 + 2, shade(c, 0.6), 0.6);
    disc(glow, x, y, 8, c, Math.min(0.3, 0.06 + 0.12 * charge + energy));
    arcBand(g, x, y, 7.4, 1.4, LIGHT - 0.7, LIGHT + 0.6, 0xffffff, 0.35);
    if (kick > 0) ring(glow, mouth.x, mouth.y, 3 + (1 - kick) * 6, 1.2, shade(c, 0.4), 0.3 * kick);
    if (maxed) bolt(ctx, 1.4);
    muzzleGlow(ctx, end + 1, 4);
  },
} satisfies Partial<Record<TurretStyle, Drawing>>;
