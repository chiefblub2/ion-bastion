import { describe, it, expect } from "vitest";
import { Game } from "./game";
import { TOWERS } from "../content/towers";
import { maxTowerLevel, purchaseUpgrade, previewUpgrade, resolveUpgrades, upgradeOption, validateUpgradeDefinitions } from "./upgrades";
import { effectiveTowerStats } from "../systems/auras";
import { isSupport } from "../systems/attacks";
import type { TowerDefinition, TowerId } from "./types";

function setup(type: TowerId) {
  const game = new Game(); game.state.wallets[0] = 2000;
  const result = game.command({ type: "build", tower: type, x: 4, y: 4 });
  const tower = game.state.towers.find(t => t.id === result.id)!;
  return { game, tower };
}

describe("unified upgrade purchases", () => {
  it("checks prerequisites, duplicate purchases and tower-specific IDs without spending money", () => {
    const { game, tower } = setup("pulse");
    for (const id of ["level-3", "damage", "", "unknown", "__proto__"]) {
      const before = JSON.stringify(game.state);
      expect(game.command({ type: "upgrade", id: tower.id, upgrade: id }).ok).toBe(false);
      expect(JSON.stringify(game.state)).toBe(before);
    }
    expect(upgradeOption(tower, "level-3", game.state.wallets[0]).status).toBe("locked");
    expect(game.command({ type: "upgrade", id: tower.id, upgrade: "level-2" }).ok).toBe(true);
    const before = JSON.stringify(game.state);
    expect(game.command({ type: "upgrade", id: tower.id, upgrade: "level-2" }).ok).toBe(false);
    expect(JSON.stringify(game.state)).toBe(before);
    expect(upgradeOption(tower, "level-3", game.state.wallets[0]).status).toBe("available");
  });
  it("keeps preview, affordability and the eventual purchase in agreement for every existing upgrade", () => {
    for (const type of Object.keys(TOWERS) as TowerId[]) {
      let { game, tower } = setup(type);
      for (const upgrade of TOWERS[type].upgrades) {
        // Paths exclude each other; the catalog is sorted by path, so start a fresh tower per path.
        if (upgradeOption(tower, upgrade.id, Infinity).status === "excluded") ({ game, tower } = setup(type));
        game.state.wallets[0] = upgrade.cost - 1;
        const before = JSON.stringify(game.state);
        const preview = previewUpgrade(tower, upgrade.id)!;
        expect(preview).not.toBeNull();
        expect(preview).not.toBe(tower);
        expect(preview.upgrades).not.toBe(tower.upgrades);
        expect(upgradeOption(tower, upgrade.id, game.state.wallets[0]).status).toBe("unaffordable");
        expect(purchaseUpgrade(game.state, tower, upgrade.id).ok).toBe(false);
        expect(JSON.stringify(game.state)).toBe(before);
        game.state.wallets[0] = upgrade.cost;
        const investment = tower.spent;
        expect(game.command({ type: "upgrade", id: tower.id, upgrade: upgrade.id }).ok).toBe(true);
        expect(resolveUpgrades(tower)).toEqual(resolveUpgrades(preview));
        expect(tower.spent).toBe(investment + upgrade.cost);
        expect(game.state.wallets[0]).toBe(0);
        expect(previewUpgrade(tower, upgrade.id)).toBeNull();
      }
    }
  });
  it("preserves all previous level stats, costs and sale refunds", () => {
    const original = {
      pulse: { damage: 18, range: 2.65, interval: .55, cost: 80 },
      blast: { damage: 40, range: 2.9, interval: 1.5, cost: 130 },
      frost: { damage: 9, range: 2.5, interval: .7, cost: 100 },
    };
    for (const type of Object.keys(original) as (keyof typeof original)[]) {
      const { game, tower } = setup(type), base = original[type];
      for (let level = 1; level <= 3; level++) {
        const own = resolveUpgrades(tower);
        expect(own.level).toBe(level);
        expect(own.stats.damage).toBe(Math.round(base.damage * Math.pow(1.65, level - 1)));
        expect(own.stats.range).toBeCloseTo(base.range + (level - 1) * .3);
        expect(own.stats.interval).toBeCloseTo(base.interval * Math.pow(.9, level - 1));
        if (level < 3) {
          const before = game.state.wallets[0];
          game.command({ type: "upgrade", id: tower.id, upgrade: `level-${level + 1}` });
          expect(before - game.state.wallets[0]).toBe(Math.round(base.cost * (level === 1 ? .9 : 1.5)));
        }
      }
      const before = game.state.wallets[0], expectedRefund = Math.floor((base.cost + Math.round(base.cost * .9) + Math.round(base.cost * 1.5)) * .7);
      game.command({ type: "sell", id: tower.id });
      expect(game.state.wallets[0] - before).toBe(expectedRefund);
    }
  });
  it("previews normal upgrades with active aura bonuses and preserves cooldown progress", () => {
    const { game, tower } = setup("pulse");
    const source = game.command({ type: "build", tower: "aura", x: 3, y: 4 }).id!;
    game.command({ type: "upgrade", id: source, upgrade: "damage" });
    tower.cooldown = .42;
    const preview = previewUpgrade(tower, "level-2")!;
    const expected = effectiveTowerStats(preview, game.state.towers);
    game.command({ type: "upgrade", id: tower.id, upgrade: "level-2" });
    expect(effectiveTowerStats(tower, game.state.towers)).toEqual(expected);
    expect(expected.damage).toBe(37.5);
    expect(tower.cooldown).toBe(.42);
  });
  it("derives results independently of the purchased-list order", () => {
    const { tower } = setup("pulse");
    expect(resolveUpgrades({ ...tower, upgrades: ["level-3", "level-2"] }))
      .toEqual(resolveUpgrades({ ...tower, upgrades: ["level-2", "level-3"] }));
  });
  it("still rejects purchases after mission end and clears them on restart", () => {
    const { game, tower } = setup("aura");
    game.state.status = "lost";
    expect(game.command({ type: "upgrade", id: tower.id, upgrade: "range" }).ok).toBe(false);
    expect(tower.upgrades).toEqual([]);
    game.command({ type: "restart" });
    expect(game.state.towers).toEqual([]);
  });
});

describe("upgrade content validation", () => {
  const fixture = (): TowerDefinition => structuredClone(TOWERS.pulse);
  it("rejects duplicate IDs, missing prerequisites and cycles", () => {
    const duplicate = fixture(); duplicate.upgrades = [...duplicate.upgrades, duplicate.upgrades[0]];
    expect(() => validateUpgradeDefinitions(duplicate)).toThrow("doppelte");
    const missing = fixture(); missing.upgrades = [{ ...missing.upgrades[0], requires: ["missing"] }];
    expect(() => validateUpgradeDefinitions(missing)).toThrow("Unbekannte");
    const cyclic = fixture(); cyclic.upgrades = cyclic.upgrades.map(u => u.id === "level-2" ? { ...u, requires: ["level-3"] } : u);
    expect(() => validateUpgradeDefinitions(cyclic)).toThrow("Zyklische");
  });
  it("rejects invalid prices and effects and accepts declarative future prerequisites", () => {
    const invalidCost = fixture(); invalidCost.upgrades = [{ ...invalidCost.upgrades[0], cost: -1 }];
    expect(() => validateUpgradeDefinitions(invalidCost)).toThrow("Kosten");
    const invalidEffect = fixture(); invalidEffect.upgrades = [{ ...invalidEffect.upgrades[0], effects: { stats: { interval: 0 } } }];
    expect(() => validateUpgradeDefinitions(invalidEffect)).toThrow("Upgrade-Wert");
    const misplacedAura = fixture(); misplacedAura.upgrades = [{ ...misplacedAura.upgrades[0], effects: { aura: { damage: .3 } } }];
    expect(() => validateUpgradeDefinitions(misplacedAura)).toThrow("Aura-Upgrade");
    const future = fixture(); future.upgrades = [...future.upgrades, { id: "level-6", label: "Stufe 6", description: "Mehr Schaden.", cost: 300, requires: ["level-5"], effects: { level: 6, stats: { damage: 80 } } }];
    expect(() => validateUpgradeDefinitions(future)).not.toThrow();
  });
});
describe("late levels 4 and 5", () => {
  const attackTowers = (Object.keys(TOWERS) as TowerId[]).filter((id) => !isSupport(TOWERS[id].attack));
  const levels = (n: number) => Array.from({ length: n - 1 }, (_, i) => `level-${i + 2}`);
  const dpsPerCredit = (type: TowerId, n: number) => {
    const { stats } = resolveUpgrades({ type, upgrades: levels(n) });
    const spent = TOWERS[type].cost + levels(n).reduce((sum, id) => sum + TOWERS[type].upgrades.find((u) => u.id === id)!.cost, 0);
    return stats.damage / stats.interval / spent;
  };
  it("every attack tower reaches level 5, each level costs more than the previous one", () => {
    for (const type of attackTowers) {
      expect(maxTowerLevel(type)).toBe(5);
      const costs = TOWERS[type].upgrades.map((u) => u.cost);
      for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
  });
  it("one high-level tower beats several base towers per credit", () => {
    for (const type of attackTowers) {
      expect(dpsPerCredit(type, 4)).toBeGreaterThan(dpsPerCredit(type, 1));
      expect(dpsPerCredit(type, 5)).toBeGreaterThan(dpsPerCredit(type, 1));
    }
  });
  it("Kryo and Tesla gain special values on levels 4 and 5", () => {
    const frost = (n: number) => resolveUpgrades({ type: "frost", upgrades: levels(n) }).attack;
    const tesla = (n: number) => resolveUpgrades({ type: "tesla", upgrades: levels(n) }).attack;
    expect(frost(3)).toMatchObject({ factor: 0.55, duration: 1.9 });
    expect(frost(4)).toMatchObject({ factor: 0.45, duration: 2.3 });
    expect(frost(5)).toMatchObject({ factor: 0.35, duration: 2.8 });
    expect(tesla(3)).toMatchObject({ jumps: 3, range: 1.6, falloff: 0.75 });
    expect(tesla(4)).toMatchObject({ jumps: 4, range: 1.8 });
    expect(tesla(5)).toMatchObject({ jumps: 5, range: 2 });
  });
  it("the newer attack towers gain special values on levels 4 and 5", () => {
    const attack = (type: TowerId, n: number) => resolveUpgrades({ type, upgrades: levels(n) }).attack;
    expect(attack("lance", 4)).toMatchObject({ width: 0.35, falloff: 0.9 });
    expect(attack("lance", 5)).toMatchObject({ width: 0.5, falloff: 1 });
    expect(attack("inferno", 4)).toMatchObject({ ratio: 3, duration: 3 });
    expect(attack("inferno", 5)).toMatchObject({ ratio: 3.5, duration: 3.5 });
    expect(attack("stasis", 4)).toMatchObject({ radius: 1.1, duration: 1, recovery: 1.5 });
    expect(attack("stasis", 5)).toMatchObject({ radius: 1.3, duration: 1.2 });
    expect(attack("acid", 4)).toMatchObject({ amount: 0.3, radius: 0.8 });
    expect(attack("acid", 5)).toMatchObject({ amount: 0.4, radius: 1 });
    expect(attack("decay", 4)).toMatchObject({ percent: 0.05 });
    expect(attack("decay", 5)).toMatchObject({ percent: 0.06 });
  });
  it("the refinery has three levels that raise its income", () => {
    expect(maxTowerLevel("refinery")).toBe(3);
    const income = (upgrades: string[]) => resolveUpgrades({ type: "refinery", upgrades }).attack;
    expect(income([])).toMatchObject({ amount: 25 });
    expect(income(["level-2"])).toMatchObject({ amount: 40 });
    expect(income(["level-2", "level-3"])).toMatchObject({ amount: 60 });
  });
  it("rejects attack values on towers that cannot use them", () => {
    const pulse = { ...TOWERS.pulse, upgrades: [{ ...TOWERS.pulse.upgrades[0], effects: { attack: { factor: 0.5 } } }] };
    expect(() => validateUpgradeDefinitions(pulse)).toThrow("Angriffswert");
    const frost = { ...TOWERS.frost, upgrades: [{ ...TOWERS.frost.upgrades[0], effects: { attack: { factor: 1.5 } } }] };
    expect(() => validateUpgradeDefinitions(frost)).toThrow("frost › Upgrade level-2");
  });
});
