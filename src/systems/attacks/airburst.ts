import type { AirburstAttack } from "../../core/types";
import { applyStatus } from "../status";
import { dist } from "../path";
import { layerOf } from "../traits";
import { wingclip } from "./direct";
import { blast, chainReaction } from "./splash";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Skyburst: a homing missile with a proximity fuse. It bursts where its target is, not where it was at
 * fire time, so fast flyers cannot outrun it; the blast hits only what the tower can target.
 */
export const airburst: AttackModule<AirburstAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    radius: { label: "Blast radius", valid: (v) => v > 0, unit: " cells" },
  },
  apply: (sim, src, { enemy, at }, damage, spec) => {
    const centre = enemy ? { x: enemy.x, y: enemy.y } : at,
      special = src.special,
      // Shear Front and Downdraft act on the flyers the burst reaches; offspring released by its kills are spared.
      reached = special?.kind === "wingclip" || special?.kind === "downdraft"
        ? sim.state.enemies.filter((e) => e.hp > 0 && dist(e, centre) <= spec.radius && canTarget(sim, src.type, e))
        : [],
      killed = blast(sim, src, centre, spec.radius, damage, "airburst");
    for (const e of reached) {
      if (e.hp <= 0 || layerOf(sim, e) !== "air") continue;
      if (special?.kind === "wingclip") wingclip(sim, src, e);
      else if (special?.kind === "downdraft") applyStatus(sim, e, { kind: "netted", factor: special.factor, until: sim.state.time + special.duration });
    }
    chainReaction(sim, src, killed, damage, "airburst");
  },
};
