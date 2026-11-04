import { describe, it, expect } from "vitest";
import { Game, sellValue } from "../core/game";
import { TOWERS } from "./towers";
import { SPECIALIZATIONS } from "./specializations";
import { isSupport } from "../systems/attacks";
import { maxTowerLevel, resolveUpgrades, towerPath, upgradeOption, upgradeOptions, validateUpgradeDefinitions } from "../core/upgrades";
import type { TowerDefinition, TowerId } from "../core/types";

const SPECIALIZED = Object.keys(SPECIALIZATIONS) as TowerId[];
const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
/** Build costs and tier prices from the specification (chapter 5). */
const PRICES: Record<string, [number, number, number, number]> = {
  pulse: [80, 200, 320, 480], blast: [130, 325, 520, 780], frost: [100, 250, 400, 600], flak: [90, 225, 360, 540],
  tesla: [150, 375, 600, 900], lance: [170, 425, 680, 1020], inferno: [120, 300, 480, 720], stasis: [140, 350, 560, 840],
  acid: [110, 275, 440, 660], decay: [160, 400, 640, 960], focus: [150, 375, 600, 900], mortar: [160, 400, 640, 960],
  quake: [140, 350, 560, 840], executioner: [150, 375, 600, 900], shrapnel: [130, 325, 520, 780], jammer: [130, 325, 520, 780],
  net: [110, 275, 440, 660], gravity: [170, 425, 680, 1020], skyburst: [140, 350, 560, 840],
  catalyst: [130, 325, 520, 780], plasma: [140, 350, 560, 840],
  orbital: [220, 550, 880, 1320], mesmer: [150, 375, 600, 900], amber: [160, 400, 640, 960], magnetar: [150, 375, 600, 900], cyclone: [140, 350, 560, 840],
  tether: [130, 325, 520, 780], shrink: [140, 350, 560, 840], hex: [150, 375, 600, 900], siphon: [150, 375, 600, 900],
};

function built(type: TowerId, upgrades: string[] = LEVELS) {
  const game = new Game();
  game.state.wallets[0] = 100000;
  const tower = game.state.towers[game.state.towers.push({ id: 1, type, x: 4, y: 4, upgrades: [...upgrades], cooldown: 0, spent: TOWERS[type].cost, angle: 0, kills: 0, owner: 0 }) - 1];
  game.state.nextId = 2;
  return { game, tower };
}

describe("tower specializations: content", () => {
  it("covers every attack and control tower with three paths of three tiers (T-001)", () => {
    const attackers = (Object.keys(TOWERS) as TowerId[]).filter((id) => TOWERS[id].placement !== "path" && !isSupport(TOWERS[id].attack));
    expect(attackers.every((id) => SPECIALIZED.includes(id))).toBe(true);
    for (const type of attackers) {
      const upgrades = TOWERS[type].upgrades, paths = new Set(upgrades.map((u) => u.path).filter(Boolean));
      expect(upgrades).toHaveLength(13);
      expect(paths.size).toBe(3);
      expect(maxTowerLevel(type)).toBe(8);
      expect(Object.keys(TOWERS[type].visual.paths ?? {}).sort()).toEqual([...paths].sort());
      for (const [index, { slug }] of SPECIALIZATIONS[type].entries())
        for (const tier of [1, 2, 3]) {
          const upgrade = upgrades.find((u) => u.id === `${slug}-${tier}`)!;
          expect(upgrade, `${type} ${slug}-${tier}`).toBeDefined();
          expect(upgrade.path).toBe(slug);
          expect(upgrade.requires).toEqual([tier === 1 ? "level-5" : `${slug}-${tier - 1}`]);
          expect(upgrade.effects.level).toBe(5 + tier);
          expect(upgrade.cost).toBe(PRICES[type][tier]);
          expect(TOWERS[type].cost).toBe(PRICES[type][0]);
          expect(index).toBeLessThan(3);
        }
    }
  });
  it("gives traps levels 6–8 and support towers levels 4–6 after their last plain level, never changing a trap's radius", () => {
    for (const type of Object.keys(TOWERS) as TowerId[]) {
      const definition: TowerDefinition = TOWERS[type], tiers = definition.upgrades.filter((u) => u.path && u.effects.level !== undefined);
      if (definition.placement !== "path" && !isSupport(definition.attack)) continue;
      const trap = definition.placement === "path";
      expect(tiers, type).toHaveLength(9);
      expect(new Set(tiers.map((u) => u.path)).size, type).toBe(3);
      expect(maxTowerLevel(type), type).toBe(trap ? 8 : type === "aura" ? 7 : 6);
      expect(Object.keys(definition.visual.paths ?? {}).sort()).toEqual([...new Set(tiers.map((u) => u.path!))].sort());
      if (trap) {
        expect(tiers.every((u) => u.effects.stats?.range === undefined), type).toBe(true);
        expect(tiers.filter((u) => u.id.endsWith("-1")).every((u) => u.requires[0] === "level-5" && u.cost === Math.round(definition.cost * 2.5)), type).toBe(true);
      } else {
        // A support path never touches the tower's own values: no stats and no attack overrides.
        expect(tiers.every((u) => !u.effects.stats && !u.effects.attack && !!u.effects.specialization), type).toBe(true);
      }
    }
  });
  it("stores final values per tier instead of stacking them (M-001, M-002)", () => {
    const overclock = resolveUpgrades({ type: "pulse", upgrades: [...LEVELS, "overclock-1", "overclock-2"] });
    expect(overclock.stats.interval).toBeCloseTo(0.2475);
    expect(overclock.stats.damage).toBe(resolveUpgrades({ type: "pulse", upgrades: LEVELS }).stats.damage);
    expect(resolveUpgrades({ type: "pulse", upgrades: [...LEVELS, "overclock-1"] }).stats.interval).toBeCloseTo(0.2805);
    const storm = resolveUpgrades({ type: "tesla", upgrades: [...LEVELS, "storm-network-1", "storm-network-2", "storm-network-3"] });
    expect(storm.level).toBe(8);
    expect(storm.attack).toMatchObject({ jumps: 8, range: 2.6, falloff: 0.75 });
    const longshot = resolveUpgrades({ type: "lance", upgrades: [...LEVELS, "longshot-1", "longshot-2", "longshot-3"] });
    expect(longshot.stats.range).toBeCloseTo(resolveUpgrades({ type: "lance", upgrades: LEVELS }).stats.range + 2.3);
    const ricochet = resolveUpgrades({ type: "pulse", upgrades: [...LEVELS, "ricochet-1", "ricochet-2"] });
    expect(ricochet.specialization).toEqual({ kind: "ricochet", every: 3, factor: 0.5, radius: 1.5 });
    expect(resolveUpgrades({ type: "pulse", upgrades: LEVELS }).specialization).toBeUndefined();
    const mobile = resolveUpgrades({ type: "mortar", upgrades: [...LEVELS, "mobile-artillery-1", "mobile-artillery-2", "mobile-artillery-3"] });
    expect(mobile.attack).toMatchObject({ minRange: 0, radius: 1.7 });
  });
});

describe("tower specializations: purchase rules", () => {
  it("unlocks the three first tiers only after level five (T-002, T-003)", () => {
    const tower = { type: "pulse" as const, upgrades: ["level-2", "level-3", "level-4"] };
    expect(upgradeOption(tower, "ricochet-1", Infinity).status).toBe("locked");
    tower.upgrades.push("level-5");
    for (const id of ["sharpshooter-1", "overclock-1", "ricochet-1"]) expect(upgradeOption(tower, id, Infinity).status).toBe("available");
  });
  it("fixes the path with the first tier, also against direct commands (T-004, T-005, T-006)", () => {
    const { game, tower } = built("pulse");
    expect(game.command({ type: "upgrade", id: 1, upgrade: "ricochet-2" })).toMatchObject({ ok: false, code: "upgrade-locked" });
    expect(game.command({ type: "upgrade", id: 1, upgrade: "ricochet-1" }).ok).toBe(true);
    expect(towerPath(tower)).toBe("ricochet");
    for (const id of ["sharpshooter-1", "overclock-1"]) {
      expect(upgradeOption(tower, id, Infinity).status).toBe("excluded");
      const before = JSON.stringify(game.state);
      expect(game.command({ type: "upgrade", id: 1, upgrade: id })).toMatchObject({ ok: false, code: "upgrade-excluded" });
      expect(JSON.stringify(game.state)).toBe(before);
    }
    expect(game.command({ type: "upgrade", id: 1, upgrade: "ricochet-2" }).ok).toBe(true);
    expect(game.command({ type: "upgrade", id: 1, upgrade: "ricochet-3" }).ok).toBe(true);
    expect(resolveUpgrades(tower).level).toBe(8);
    expect(upgradeOptions(tower).filter((o) => o.status === "available")).toHaveLength(0);
  });
  it("charges the tier price and refunds 70% of everything spent (T-007, T-008)", () => {
    const { game, tower } = built("pulse");
    const wallet = game.state.wallets[0], spent = tower.spent;
    game.command({ type: "upgrade", id: 1, upgrade: "overclock-1" });
    expect(game.state.wallets[0]).toBe(wallet - 200);
    expect(tower.spent).toBe(spent + 200);
    game.command({ type: "upgrade", id: 1, upgrade: "overclock-2" });
    game.command({ type: "upgrade", id: 1, upgrade: "overclock-3" });
    expect(tower.spent).toBe(spent + 1000);
    expect(sellValue(tower)).toBe(Math.floor((spent + 1000) * 0.7));
  });
  it("lets a path start from level 5 but never cross into another path (T-010)", () => {
    const pulse = TOWERS.pulse;
    const crossing = { ...pulse, upgrades: pulse.upgrades.map((u) => (u.id === "overclock-2" ? { ...u, requires: ["ricochet-1"] } : u)) };
    expect(() => validateUpgradeDefinitions(crossing)).toThrow("another path");
    const leaving = { ...pulse, upgrades: [...pulse.upgrades, { id: "level-9", label: "Level 9", description: "More.", cost: 999, requires: ["overclock-3"], effects: { level: 9 } }] };
    expect(() => validateUpgradeDefinitions(leaving)).toThrow("another path");
    const cyclic = { ...pulse, upgrades: pulse.upgrades.map((u) => (u.id === "overclock-1" ? { ...u, requires: ["overclock-3"] } : u)) };
    expect(() => validateUpgradeDefinitions(cyclic)).toThrow("Cyclic");
    const broken = { ...pulse, upgrades: pulse.upgrades.map((u) => (u.id === "ricochet-1" ? { ...u, effects: { ...u.effects, specialization: { kind: "ricochet" as const, every: 0, factor: 0.35, radius: 1.3 } } } : u)) };
    expect(() => validateUpgradeDefinitions(broken)).toThrow("positive integer");
    const negative = { ...pulse, upgrades: pulse.upgrades.map((u) => (u.id === "ricochet-1" ? { ...u, effects: { ...u.effects, specialization: { kind: "ricochet" as const, every: 4, factor: 0.35, radius: -1 } } } : u)) };
    expect(() => validateUpgradeDefinitions(negative)).toThrow("positive");
    for (const type of SPECIALIZED) expect(() => validateUpgradeDefinitions(TOWERS[type])).not.toThrow();
  });
});
