import type { PathMotif } from "../../core/types";
import { ring } from "../shapes";
import { type TurretContext, TAU, quad, fins } from "./kit";
/** Path motifs of Aura towers and specialized attack towers; `tier` (1–3) adds detail, `echo` repeats them in light. */
export const MOTIFS: Record<PathMotif, (ctx: TurretContext, tier: number, time: number, echo?: number) => void> = {
  // Damage: pairs of blades turning slowly, each lit on the side that faces the light.
  blades: ({ g, glow, x, y, color: c }, tier, time, echo = 0) => {
    const blades = Array.from({ length: tier * 2 }, (_, i) => time * 0.5 + (i * TAU) / (tier * 2));
    fins(g, x, y, blades, 9, 18, 3.5, 0, c);
    if (!echo) return;
    glow.fillStyle(c, echo);
    for (const a of blades) quad(glow, x, y, Math.cos(a), Math.sin(a), 9, 18.5, -3.8, 3.8, 0, 0);
  },
  // Speed: spiral arms whirling faster per tier.
  vortex: ({ g, glow, x, y, color: c }, tier, time, echo = 0) => {
    const arms = tier + 1,
      inks = echo ? [glow, g] : [g];
    glow.lineStyle(4, c, echo);
    g.lineStyle(2, c, 0.85);
    for (const ink of inks) {
      ink.beginPath();
      for (let i = 0; i < arms; i++) {
        const start = time * (2 + tier) + (i * TAU) / arms;
        for (let k = 0; k < 8; k++) {
          const a = start + k * 0.17,
            r = 7 + k * 1.45;
          if (k) ink.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          else ink.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
      }
      ink.strokePath();
    }
  },
  // Range: rings pulsing outwards, fading at the plate edge.
  rings: ({ g, glow, x, y, color: c }, tier, time, echo = 0) => {
    for (let i = 0; i < tier; i++) {
      const phase = (time * 0.6 + i / tier) % 1,
        r = 9 + phase * 13;
      ring(g, x, y, r, 1.5, c, (1 - phase) * 0.85);
      if (echo) ring(glow, x, y, r, 3, c, echo * (1 - phase));
    }
  },
};
