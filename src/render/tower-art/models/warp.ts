import { halo } from "../../material";
import { arcBand, disc, oval, ring, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, drum, onGround } from "../tilt";
import { DROP, IRON, at, chase, ngon, readyLight, readySocket, recess, slab, trapTilt, trim } from "./kit-traps-b";
import type { TiltedConcept as Concept } from "../tilted";

/** Pad radius and height, portal radius, emitter stud ring. */
const R = 18,
  H = 2.6,
  PORTAL = 12,
  STUD_R = 15.4,
  STUDS = Array.from({ length: 6 }, (_, i) => Math.PI / 6 + (i * Math.PI) / 3);
const TAU = Math.PI * 2;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  recess(g, x, y0, ngon(16, R), 1.08);
  drum(g, x, y0, R, 0, H, IRON.wall, IRON.top, 16);
  // The portal well: a deep black disc ringed by a dark lip in the tower's blue.
  onGround(g, x, y0, H, () => {
    disc(g, 0, 0, PORTAL + 1.6, shade(c, -0.7));
    disc(g, 0, 0, PORTAL + 0.6, OUTLINE);
    disc(g, 0, 0, PORTAL, 0x03050d);
    if (level >= 5) ring(g, 0, 0, R - 1.2, 0.9, shade(color, -0.15), 0.95);
    if (level >= 3) for (let i = 0; i < 12; i++) arcBand(g, 0, 0, PORTAL + 1.1, 0.6, (i * TAU) / 12, (i * TAU) / 12 + 0.2, IRON.metal, 0.6);
  });
  // Emitter studs round the rim: short posts, the back ones first.
  for (const t of [...STUDS].sort((a, b) => Math.sin(a) - Math.sin(b)))
    slab(g, x, y0, ngon(6, 1.5), H, H + 2.2, 0, IRON.wall, shade(c, -0.35), shade(c, 0.3), 1, Math.cos(t) * STUD_R, Math.sin(t) * STUD_R);
  if (level >= 2) readySocket(g, x, y0, 12.5, 11.5, H + 0.2, c);
}
/** From level 4 the studs light one after another round the rim. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, STUDS.map((t) => [Math.cos(t) * STUD_R, Math.sin(t) * STUD_R] as const), H + 2.6);
}
/**
 * The portal: three spiral arms turning over the black well (faster once charged), the charge filling a ring round the
 * well, a soft column of light while armed, and a flash when it folds an enemy back (`kick`).
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, clock, charge, kick } = ctx,
    y0 = y + DROP,
    c = definition.color,
    ready = charge >= 1,
    spin = clock * (ready ? 3.2 : 0.9) + tower.id;
  onGround(g, x, y0, H, () => {
    for (const ink of ready ? [glow, g] : [g]) {
      const light = ink === glow;
      ink.lineStyle(light ? 3 : 1.2, light ? c : shade(c, 0.35), light ? 0.22 : ready ? 0.95 : 0.45);
      ink.beginPath();
      for (let arm = 0; arm < 3; arm++)
        for (let k = 0; k < 8; k++) {
          const a = spin + (arm * TAU) / 3 + k * 0.34,
            r = PORTAL - 0.8 - k * 1.3;
          if (k) ink.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else ink.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
      ink.strokePath();
    }
    arcBand(g, 0, 0, PORTAL + 1.1, 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * charge, shade(trim(ctx), 0.1), 0.9);
    disc(g, 0, 0, 1.4, ready ? 0xffffff : shade(c, -0.3), ready ? 0.85 : 0.6);
    if (ready) disc(glow, 0, 0, PORTAL, c, 0.12 + 0.05 * Math.sin(clock * 4 + tower.id));
  });
  // Armed: a faint column of light stands over the well.
  if (ready) {
    const [cx, cy] = at(x, y0, 0, 0, H + 5);
    oval(glow, cx, cy, 6, 5, c, 0.08);
  }
  if (kick > 0) {
    onGround(glow, x, y0, H, () => ring(glow, 0, 0, 3 + 13 * (1 - kick), 2, shade(c, 0.4), 0.45 * kick));
    const [cx, cy] = at(x, y0, 0, 0, H + 3);
    halo(glow, cx, cy, 8 * (1 + kick), c, 0.3 * kick);
  }
  if (level >= 2) readyLight(ctx, x, y0, 12.5, 11.5, H + 0.2);
}

export const concept: Concept = {
  tower: "warp",
  name: "Fold Well",
  idea: "A low round pad with a black portal well ringed by six emitter studs; spiral arms turn over the well, faster once charged, and it flashes when it folds an enemy back.",
  tilt: trapTilt(2.6),
  base,
  below,
  turret: () => {},
  above,
};
