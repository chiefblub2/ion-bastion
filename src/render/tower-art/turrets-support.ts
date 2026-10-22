import type { TurretStyle } from "../../core/types";
import { DARK, LIGHT, OUTLINE, PLATE, SHADOW, dome, glowLine, halo, litBar } from "../material";
import { arcBand, chamferRect, disc, hash01, oval, polygon, ring, shade, star, strip, wedge } from "../shapes";
import { type Drawing, TAU, at, tick, pip, fins, loop, block, boss, glowDot, bolt, hexLine } from "./kit";
import { MOTIFS } from "./motifs";
/** Turret drawings of the Support tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. */
export const SUPPORT_TURRETS = {
  // A gold coin turning slowly: its rim shows as it turns, and its face glints towards the viewer.
  beacon: (ctx) => {
    const { g, x, y, definition: d, level, clock } = ctx,
      c = d.color,
      face = Math.cos(clock * 1.6),
      w = Math.abs(face) * 9 + 2;
    oval(g, x, y + 3, 10, 4.5, shade(c, -0.5));
    oval(g, x + Math.sin(clock * 1.6) * 2.2, y - 2, w + 0.3, 9, shade(c, -0.4));
    oval(g, x, y - 2, w, 9, c);
    oval(g, x, y - 2, w * 0.55, 5.5, shade(c, 0.45), 0.8);
    const shine = Math.max(0, (Math.abs(face) - 0.85) / 0.15);
    if (shine > 0) star(g, x - 3, y - 6, 3.4, 0.7, 4, 0xffffff, 0, shine);
    g.fillStyle(c, 0.8);
    for (let i = 0; i < level; i++) {
      const p = at(x, y, clock + (i * TAU) / Math.max(1, level), 14);
      pip(g, p.x, p.y, 1.6);
    }
  },
  // A raised repair cross with a welding spark orbiting it.
  dock: (ctx) => {
    const { g, glow, x, y, definition: d, level, clock } = ctx,
      c = d.color;
    boss(g, x, y, 11, shade(c, -0.55));
    g.fillStyle(SHADOW, 0.45);
    g.fillRect(x - 7, y - 1.5, 16, 5);
    g.fillRect(x - 1.5, y - 7, 5, 16);
    g.fillStyle(c, 0.95);
    g.fillRect(x - 8, y - 2.5, 16, 5);
    g.fillRect(x - 2.5, y - 8, 5, 16);
    g.fillStyle(shade(c, 0.5));
    g.fillRect(x - 8, y - 2.5, 16, 1.2);
    g.fillRect(x - 2.5, y - 8, 1.2, 16);
    const p = at(x, y, clock * (1.5 + level * 0.3), 13),
      flick = 0.6 + 0.4 * Math.sin(clock * 20);
    star(glow, p.x, p.y, 5, 1, 4, shade(c, 0.6), clock * 3, 0.3 * flick);
    disc(glow, p.x, p.y, 3, c, 0.25 * flick);
    disc(g, p.x, p.y, 1.2, 0xffffff, 0.8 + 0.2 * flick);
  },
  // A sweeping laser dish.
  tracker: (ctx) => {
    const { g, glow, x, y, definition: d, level, clock } = ctx,
      c = d.color,
      tip = at(x, y, clock * 1.2, 13 + level);
    ring(g, x, y, 11, 1, c, 0.35);
    glowLine(glow, x, y, tip.x, tip.y, c, 1, 0.3);
    g.lineStyle(0.8, shade(c, 0.6), 0.9);
    g.lineBetween(x, y, tip.x, tip.y);
    boss(g, x, y, 6, shade(c, -0.5));
    disc(g, x, y, 2.5, c);
    disc(glow, tip.x, tip.y, 2.6, c, 0.3);
    disc(g, tip.x, tip.y, 1, shade(c, 0.7));
  },
  // A gear with lit teeth that turns faster with every level, and a chimney that puffs.
  refinery: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      spin = clock * (0.4 + 0.4 * level) + t.id,
      phase = (clock * 0.6 + t.id * 0.3) % 1;
    chamferRect(g, x + 12, y - 12, 2.8, 2.8, 0.8, shade(PLATE, -0.15));
    chamferRect(g, x + 12.3, y - 11.7, 1.8, 1.8, 0.5, OUTLINE);
    disc(g, x + 12.5 + 2 * phase, y - 13 - 8 * phase, 1.6 + 2.6 * phase, 0x9aa3a8, 0.45 * (1 - phase));
    const teeth = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => spin + (i * Math.PI) / 4);
    fins(g, x, y, teeth, 7, 12.5, 2.3, 1.8, c);
    boss(g, x, y, 9, shade(c, -0.2));
    disc(g, x, y, 6, c);
    bolt(ctx, 2.4);
  },
  // A sweeping scan fan of light and a dish that turns with it; faster with every level.
  radar: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      a = clock * (1.2 + 0.4 * level) + t.id;
    wedge(glow, x, y, 17, a - 0.72, a, c, 0.1);
    wedge(glow, x, y, 17, a - 0.26, a, c, 0.12);
    ring(g, x, y, 9, 1, c, 0.35);
    litBar(g, x, y, a, 0, 13, 1.5, 1, c);
    litBar(g, x, y, a, 8, 11, 6, 6, shade(c, -0.2));
    disc(g, x, y, 4.5, c);
    bolt(ctx, 2);
  },
  aura: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock, color: c, path, level } = ctx,
      motif = path ? d.visual.paths?.[path]?.motif : undefined;
    ring(g, x, y, 19, 2, c, motif ? 0.55 : 0.3);
    if (!motif) {
      // Undecided: one dimmed dot per path colour hints at the choice.
      Object.values(d.visual.paths ?? {}).forEach((option, i, all) => {
        const p = at(x, y, clock * 0.4 + (i * TAU) / all.length - Math.PI / 2, 13);
        disc(g, p.x, p.y, 2.5, option.color, 0.55);
      });
      disc(g, x, y, 4, c, 0.5);
      bolt(ctx, 2);
      return;
    }
    MOTIFS[motif](ctx, Math.max(1, level), clock + t.id);
    disc(g, x, y, 5, c);
    bolt(ctx, 2);
    loop(g, x, y, 8 + Math.sin(clock * 2) * 2, 1.5, c, 0.75);
  },
  // A gear ring around a dial whose hand ticks round once a second-step at a time; the hand grows with each level.
  clock: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      gear = clock * 0.35 + t.id,
      teeth = Array.from({ length: 10 }, (_, i) => gear + (i * TAU) / 10);
    fins(g, x, y, teeth, 10, 13.5, 2.4, 1.6, shade(c, -0.2));
    boss(g, x, y, 11, shade(c, -0.5));
    disc(g, x, y, 8.6, DARK);
    g.fillStyle(shade(c, 0.2), 0.9);
    for (let i = 0; i < 12; i++) tick(g, x, y, (i * Math.PI) / 6, 6.6, i % 3 ? 7.6 : 8.3, 0.9);
    // The hand ticks: it rests, then snaps to the next mark.
    const step = Math.floor(clock * 2 + t.id),
      snap = Math.min(1, ((clock * 2 + t.id) % 1) * 6),
      a = -Math.PI / 2 + ((step + snap) * TAU) / 12,
      tip = at(x, y, a, 5.5 + level * 0.7);
    g.lineStyle(1.6, shade(c, 0.55), 1);
    g.lineBetween(x, y, tip.x, tip.y);
    glowLine(glow, x, y, tip.x, tip.y, c, 1, 0.22 + energy);
    disc(g, tip.x, tip.y, 1, 0xffffff, 0.85);
    bolt(ctx, 2);
  },
  // A rangefinder bar with a lens at each end, slowly scanning, over a reticle that tightens with each level.
  director: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      a = clock * 0.45 + t.id,
      gap = 0.5 - level * 0.08;
    for (let i = 0; i < 4; i++) {
      const q = (i * Math.PI) / 2 + Math.PI / 4;
      arcBand(g, x, y, 13, 1.4, q - Math.PI / 4 + gap, q + Math.PI / 4 - gap, shade(c, -0.1), 0.8);
    }
    litBar(g, x, y, a, -13, 13, 3, 3, shade(PLATE, 0.15), { bands: [0.3, 0.7] });
    for (const end of [-1, 1]) {
      const p = at(x, y, a, end * 12.5);
      boss(g, p.x, p.y, 3.6, shade(c, -0.5));
      disc(g, p.x, p.y, 2.2, c);
      disc(g, p.x - 0.6, p.y - 0.6, 0.8, 0xffffff, 0.8);
      glowDot(glow, p.x, p.y, 5, c, 0.25 + energy);
    }
    dome(g, x, y, 6, shade(c, -0.35));
    // A crosshair glints on the dome.
    g.lineStyle(0.8, shade(c, 0.6), 0.9);
    g.lineBetween(x - 3.5, y, x + 3.5, y);
    g.lineBetween(x, y - 3.5, x, y + 3.5);
  },
  // A revolving ammunition drum: it indexes one chamber at a time, every cartridge tipped in the tower colour.
  armory: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      beat = clock * 0.8 + t.id * 0.37,
      turn = (Math.floor(beat) + Math.min(1, (beat % 1) * 4)) * (TAU / 6);
    boss(g, x, y, 13, shade(PLATE, -0.1));
    ring(g, x, y, 12.2, 0.8, OUTLINE, 0.7);
    for (let i = 0; i < 6; i++) {
      const p = at(x, y, turn + (i * TAU) / 6, 8);
      disc(g, p.x, p.y, 3.3, DARK);
      disc(g, p.x, p.y, 2.5, 0xb08a3a);
      disc(g, p.x, p.y, 1.5, i < level * 2 ? shade(c, 0.35) : shade(c, -0.25));
      disc(g, p.x - 0.5, p.y - 0.6, 0.6, 0xffffff, 0.7);
    }
    for (let i = 0; i < level * 2; i++) {
      const p = at(x, y, turn + (i * TAU) / 6, 8);
      disc(glow, p.x, p.y, 2.6, c, 0.2 + energy);
    }
    boss(g, x, y, 4, shade(c, -0.4));
    bolt(ctx, 2);
  },
  // A dish tipped skywards with a feed horn; chevrons of light rise from it, one more per level.
  skylink: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color;
    oval(g, x + 1, y + 2.5, 12, 9, SHADOW, 0.4);
    oval(g, x, y, 12, 9, shade(c, -0.5));
    oval(g, x - 0.5, y - 0.6, 10.8, 7.8, shade(PLATE, 0.25));
    oval(g, x - 0.3, y + 0.4, 8, 5.6, shade(PLATE, -0.15));
    arcBand(g, x, y, 10.5, 1, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.5), 0.7);
    litBar(g, x, y, -Math.PI / 2, 0, 9, 1.2, 0.9, shade(PLATE, 0.2), { shadow: false });
    disc(g, x, y - 9, 2.2, c);
    disc(glow, x, y - 9, 4, c, 0.3 + energy);
    for (let i = 0; i < level + 1; i++) {
      const k = (clock * 0.8 + t.id * 0.21 + i / (level + 1)) % 1,
        cy = y - 10 - k * 12,
        fade = Math.sin(k * Math.PI);
      g.lineStyle(1.6, shade(c, 0.4), 0.85 * fade);
      g.beginPath();
      g.moveTo(x - 4, cy + 3);
      g.lineTo(x, cy);
      g.lineTo(x + 4, cy + 3);
      g.strokePath();
      glow.lineStyle(3, c, 0.22 * fade);
      glow.beginPath();
      glow.moveTo(x - 4, cy + 3);
      glow.lineTo(x, cy);
      glow.lineTo(x + 4, cy + 3);
      glow.strokePath();
    }
  },
  // A core node with six satellites turning round it on a lattice; a pulse runs from satellite to satellite.
  nexus: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      spin = clock * 0.25 + t.id,
      nodes = Array.from({ length: 6 }, (_, i) => at(x, y, spin + (i * Math.PI) / 3, 12)),
      lit = Math.floor((clock * 3 + t.id) % 6);
    hexLine(g, x, y, 12, 1, shade(c, -0.2), 0.7, spin);
    g.lineStyle(0.9, shade(c, -0.1), 0.6);
    for (const p of nodes) g.lineBetween(x, y, p.x, p.y);
    nodes.forEach((p, i) => {
      const on = i < level * 2;
      disc(g, p.x, p.y, 3, OUTLINE);
      disc(g, p.x, p.y, 2.1, on ? c : shade(c, -0.55));
      if (on && i === lit % (level * 2)) {
        disc(g, p.x, p.y, 1, 0xffffff, 0.9);
        glowDot(glow, p.x, p.y, 6, c, 0.4);
      }
    });
    dome(g, x, y, 5.5, shade(c, -0.15));
    halo(glow, x, y, 10, c, 0.12 + energy);
  },
  // An anvil and a hammer that rises and strikes on its own rhythm; every blow throws sparks, more with each level.
  workshop: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      phase = (clock / 1.4 + t.id * 0.37) % 1,
      // Slow lift, fast blow: the head sits on the anvil at phase 0.
      lift = phase < 0.75 ? Math.sin((phase / 0.75) * Math.PI * 0.5) : 1 - (phase - 0.75) / 0.25,
      blow = phase < 0.18 ? 1 - phase / 0.18 : 0,
      arm = -Math.PI * 0.15 - lift * 0.9,
      pivot = { x: x + 9, y: y + 3 };
    // Anvil: horn to the left, a lit face and a dark foot.
    chamferRect(g, x - 1, y + 5.5, 6, 2.2, 1, shade(PLATE, -0.35));
    chamferRect(g, x - 1, y + 1, 8, 3.4, 1.4, shade(PLATE, 0.05));
    g.fillStyle(shade(PLATE, 0.05));
    g.fillTriangle(x - 9, y - 2.4, x - 14, y - 0.6, x - 9, y + 1.6);
    strip(g, x - 9, y - 2.4, 1, 0, 0, 16, 0, 1, 0, 1, shade(PLATE, 0.45));
    // Handle from the pivot and the hammer head across its end, turned to the arm.
    const head = at(pivot.x, pivot.y, Math.PI + arm, 12);
    litBar(g, pivot.x, pivot.y, Math.PI + arm, 0, 12, 1.1, 1.1, shade(c, -0.45));
    block(g, head.x, head.y, Math.PI / 2 + arm, 4.6, 2.8, 0.8, shade(c, -0.15));
    block(g, head.x - 0.4, head.y - 0.6, Math.PI / 2 + arm, 3.8, 1.6, 0.6, shade(c, 0.25));
    boss(g, pivot.x, pivot.y, 3, shade(c, -0.4));
    if (blow > 0) {
      halo(glow, x - 2, y - 3, 9, c, 0.3 * blow);
      for (let i = 0; i < 3 + level * 2; i++) {
        const a = -Math.PI / 2 + (hash01(t.id, i, Math.floor(clock / 1.4)) - 0.5) * 2.6,
          r = 4 + (1 - blow) * (8 + 6 * hash01(i, t.id));
        disc(g, x - 2 + Math.cos(a) * r, y - 3 + Math.sin(a) * r, 0.9, shade(c, 0.7), blow);
      }
    }
  },
  // A round strongroom door: its dial turns to and fro, the locking bolts gleam gold, one coin lamp per upgrade.
  vault: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      dial = Math.sin(clock * 0.9 + t.id) * 1.6;
    boss(g, x, y, 12.5, shade(PLATE, 0.05));
    ring(g, x, y, 12, 1.4, shade(c, -0.25), 0.9);
    // Locking bolts around the door.
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + Math.PI / 6;
      litBar(g, x, y, a, 9, 12.4, 1.2, 1.2, shade(c, -0.1), { shadow: false });
    }
    // Dial: graduated ring and a three-spoke handle.
    ring(g, x, y, 6.5, 1.2, DARK, 0.9);
    g.fillStyle(shade(c, 0.35));
    for (let i = 0; i < 12; i++) tick(g, x, y, dial + (i * Math.PI) / 6, 5.6, 7.2, 0.6);
    for (let i = 0; i < 3; i++) litBar(g, x, y, -dial * 1.3 + (i * TAU) / 3, 0, 6, 0.9, 0.7, shade(c, -0.3));
    dome(g, x, y, 2.6, c);
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, -Math.PI / 2 + (i - 1) * 0.45, 16);
      if (i < level + 1) {
        disc(g, p.x, p.y, 1.7, c);
        disc(glow, p.x, p.y, 3, c, 0.2);
      } else disc(g, p.x, p.y, 1.4, OUTLINE, 0.8);
    }
  },
  // An emitter dome under a shimmering hex bubble; the pips around it are the shield left this wave.
  shieldgen: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock } = ctx,
      c = d.color,
      amount = t.upgrades.reduce((a, id) => d.upgrades.find((u) => u.id === id)?.effects.attack?.amount ?? a, "amount" in d.attack ? d.attack.amount : 0),
      left = Math.max(0, amount - (t.barrier ?? 0)),
      share = amount > 0 ? left / amount : 0,
      shimmer = 0.5 + 0.5 * Math.sin(clock * 3 + t.id);
    // The bubble fades as the charge runs out.
    if (share > 0) {
      polygon(glow, x, y, 13, 6, c, clock * 0.2, (0.05 + 0.05 * shimmer) * share);
      hexLine(glow, x, y, 13, 1.4, c, (0.18 + 0.12 * shimmer) * share, clock * 0.2);
    }
    for (let i = 0; i < amount; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) * TAU) / amount,
        p = at(x, y, a, 10.5);
      disc(g, p.x, p.y, 1.6, OUTLINE, 0.9);
      if (i < left) {
        disc(g, p.x, p.y, 1.1, shade(c, 0.4));
        disc(glow, p.x, p.y, 2.6, c, 0.25);
      }
    }
    dome(g, x, y, 6.5, shade(c, -0.15));
    disc(glow, x, y, 4, c, share > 0 ? 0.18 + 0.1 * shimmer : 0.05);
  },
  // A three-bladed shredder rotor; scrap chevrons orbit it the other way.
  recycler: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      spin = clock * (1.6 + 0.5 * level) + t.id;
    ring(g, x, y, 12.5, 1.6, OUTLINE, 0.7);
    for (let i = 0; i < 3; i++) {
      const a = -spin * 0.5 + (i * TAU) / 3,
        p = at(x, y, a, 12.5);
      polygon(g, p.x, p.y, 2.6, 3, c, a + Math.PI / 2, 0.9);
    }
    fins(g, x, y, [0, 1, 2].map((i) => spin + (i * TAU) / 3), 2, 10.5, 2.6, 1.2, shade(c, -0.25));
    boss(g, x, y, 4.5, shade(c, -0.45));
    disc(g, x, y, 2.4, c);
    disc(glow, x, y, 6, c, 0.12 + 0.04 * level);
  },
} satisfies Partial<Record<TurretStyle, Drawing>>;
