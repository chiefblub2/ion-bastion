import type { AlarmAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import type { AttackModule } from "./types";
/** Alarmdraht: the tripped wire reloads every attack tower around it at once. */
export const alarm: AttackModule<AlarmAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    radius: { label: "Alarm radius", valid: (v) => v > 0, unit: " cells" },
  },
  apply: (sim, src, { enemy, from }, damage, spec) => {
    if (!enemy || !from) return;
    const color = sim.content.towers[src.type].color;
    for (const t of sim.state.towers) {
      const d = sim.content.towers[t.type];
      // Support towers (no targets) have nothing to reload; traps re-arm on their own.
      if (d.placement === "path" || !d.targets.length || dist(t, from) > spec.radius) continue;
      t.cooldown = 0;
      sim.state.events.push({ type: "chain", from: { ...from }, to: { x: t.x, y: t.y }, color });
    }
    applyDamage(sim, src, enemy, damage, false, hitOf("alarm", src));
  },
};
