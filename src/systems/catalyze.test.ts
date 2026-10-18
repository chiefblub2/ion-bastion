import { describe, it, expect } from "vitest";
import { Game } from "../core/game";
import { attackEnemies } from "./combat";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { validateContent } from "../core/validation";
import { DEFAULT_CONTENT } from "../content";
import { TOWERS } from "../content/towers";
import type { CatalyzeAttack, Enemy, EnemyId, StatusEffect } from "../core/types";

const { bonus, cap } = TOWERS.catalyst.attack as CatalyzeAttack,
  BASE = TOWERS.catalyst.damage;
const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
const src = { tower: 99, type: "frost" as const };
/** Running effects that change neither speed-independent damage nor targeting. */
const EFFECTS: Record<string, StatusEffect> = {
  slow: { kind: "slow", factor: 0.5, until: 10 },
  disrupted: { kind: "disrupted", until: 10 },
  netted: { kind: "netted", factor: 0.7, until: 10 },
  bleeding: { kind: "bleeding", perCell: 1, last: 10, next: 10, until: 10, source: src },
  armorDissolved: { kind: "armorDissolved", fraction: 0.2, until: 10 },
};
/** Catalyst at (7,5) on the outpost map, optionally upgraded; one salvo is fired and landed. */
function fire(enemies: [EnemyId, number, number, StatusEffect[]][], upgrades: string[] = []) {
  const g = new Game();
  g.state.wallets[0] = 1000;
  g.command({ type: "build", tower: "catalyst", x: 7, y: 5 });
  g.state.towers[0].upgrades = upgrades;
  g.state.enemies = enemies.map(([type, x, y, status], i) => ({ ...makeEnemy(100 + i, type, x, y, 10 - i), status: status.map((s) => ({ ...s })) }));
  attackEnemies(g, 0);
  landProjectiles(g);
  return g;
}
const lost = (e: Enemy) => 1000 - e.hp;

describe("Catalyst", () => {
  it("deals its bonus once per distinct running effect", () => {
    const [a] = fire([["drone", 7, 6, [EFFECTS.slow, EFFECTS.disrupted]]]).state.enemies;
    expect(lost(a)).toBeCloseTo(BASE * (1 + 2 * bonus));
  });
  it("ignores expired effects and a stun in its recovery, and counts at most `cap`", () => {
    const stale: StatusEffect[] = [{ kind: "slow", factor: 0.5, until: -1 }, { kind: "stun", release: -1, until: 10 }];
    expect(lost(fire([["drone", 7, 6, stale]]).state.enemies[0])).toBeCloseTo(BASE);
    expect(lost(fire([["drone", 7, 6, Object.values(EFFECTS)]]).state.enemies[0])).toBeCloseTo(BASE * (1 + cap * bonus));
  });
  it("aims at the most affected enemy, whatever its priority", () => {
    const [lead, affected] = fire([["drone", 7, 6, []], ["drone", 7.5, 6, [EFFECTS.slow]]]).state.enemies;
    expect(lost(lead)).toBe(0);
    expect(lost(affected)).toBeGreaterThan(0);
  });
  it("Stabilizer lengthens running effects up to its cap, Volatile Mix splashes the neighbours", () => {
    const [held] = fire([["drone", 7, 6, [{ ...EFFECTS.slow, until: 1 }]]], [...LEVELS, "stabilizer-1"]).state.enemies;
    expect(held.status[0].until).toBeCloseTo(1.3);
    const [hit, near, far] = fire(
      [["drone", 7, 6, [EFFECTS.slow, EFFECTS.disrupted]], ["drone", 7.5, 6, []], ["drone", 9, 6, []]],
      [...LEVELS, "volatile-mix-1"],
    ).state.enemies;
    expect(lost(near)).toBeCloseTo(lost(hit) * 0.35);
    expect(lost(far)).toBe(0);
  });
  it("rejects a non-integer cap", () => {
    expect(() =>
      validateContent({ ...DEFAULT_CONTENT, towers: { ...TOWERS, catalyst: { ...TOWERS.catalyst, attack: { kind: "catalyze", bonus: 0.5, cap: 1.5 } } } }),
    ).toThrow();
  });
});
