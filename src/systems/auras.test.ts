import { describe, expect, it } from "vitest";
import { isFullyUpgraded, resolveUpgrades, towerColor, towerLevel, towerPath, upgradeOption, validateUpgradeDefinitions } from "../core/upgrades";
import { Game } from "../core/game";
import { TOWERS } from "../content/towers";
import type { Enemy, Tower, TowerId } from "../core/types";
import { auraBonuses, effectiveTowerStats, isInAura, receivedAuraBonuses } from "./auras";
import { attackEnemies } from "./combat";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { upgradeControl } from "../ui/upgrade-tooltip";
import { towerDetails } from "../ui/tower-details";

function tower(id: number, type: TowerId, x: number, y: number, upgrades: string[] = []): Tower {
  return { id, type, x, y, upgrades, cooldown: 0, spent: TOWERS[type].cost, angle: 0, kills: 0, owner: 0 };
}
function enemy(x: number, y: number): Enemy {
  return makeEnemy(100, "tank", x, y, 1);
}
function fundedGame() { const g = new Game(); g.state.wallets[0] = 2000; return g; }

describe("aura rules", () => {
  it("includes the exact radius boundary and excludes diagonal and just-outside targets", () => {
    const source = tower(1, "aura", 0, 0, ["damage"]), target = tower(2, "pulse", 3, 0);
    expect(isInAura(source, target)).toBe(true);
    expect(effectiveTowerStats(target, [source, target]).damage).toBeCloseTo(22.5);
    expect(isInAura(source, { ...target, x: 3.0001 })).toBe(false);
    expect(isInAura(source, { ...target, x: 2, y: 3 })).toBe(false);
  });
  it("takes the strongest bonus independently per property without stacking", () => {
    const target = tower(4, "pulse", 1, 1);
    const a = tower(1, "aura", 0, 0, ["damage", "damage-2"]);
    const b = tower(2, "aura", 2, 0, ["speed"]);
    const c = tower(3, "aura", 1, 0, ["range"]);
    const d = tower(5, "aura", 2, 1, ["damage"]);
    expect(receivedAuraBonuses(target, [a, b, c, d])).toEqual({ damage: .4, speed: .2, range: .15 });
    expect(receivedAuraBonuses(target, [d, c, b, a])).toEqual(receivedAuraBonuses(target, [a, b, c, d]));
  });
  it("applies bonuses after normal upgrades without altering source content or special effects", () => {
    const before = JSON.stringify(TOWERS);
    const sources = [tower(1, "aura", 0, 0, ["damage"]), tower(3, "aura", 0, 1, ["speed"]), tower(4, "aura", 1, 1, ["range"])];
    for (const type of ["pulse", "blast", "frost"] as const) {
      const target = { ...tower(2, type, 1, 0), upgrades: ["level-2", "level-3"] };
      const stats = effectiveTowerStats(target, [...sources, target]), base = resolveUpgrades({ type, upgrades: ["level-2", "level-3"] }).stats;
      expect(stats.damage).toBeCloseTo(base.damage * 1.25);
      expect(stats.range).toBeCloseTo(base.range * 1.15);
      expect(stats.interval).toBeCloseTo(base.interval / 1.2);
    }
    expect(JSON.stringify(TOWERS)).toBe(before);
  });
  it("never buffs an aura tower or propagates through another aura", () => {
    const a = tower(1, "aura", 0, 0, ["range", "range-2"]);
    const b = tower(2, "aura", 2, 0, ["damage"]);
    const target = tower(3, "pulse", 5, 0);
    expect(receivedAuraBonuses(b, [a, b])).toEqual({ damage: 0, speed: 0, range: 0 });
    expect(effectiveTowerStats(b, [a, b]).range).toBe(3);
    expect(receivedAuraBonuses(target, [a, b])).toEqual({ damage: .25, speed: 0, range: 0 });
  });
  it("has no base bonus: an aura without a path boosts nothing", () => {
    const source = tower(1, "aura", 0, 0), target = tower(2, "pulse", 1, 0);
    expect(auraBonuses(source)).toEqual({ damage: 0, speed: 0, range: 0 });
    expect(effectiveTowerStats(target, [source, target]).damage).toBe(18);
    expect(Object.values(effectiveTowerStats(target, [source, target]).bonuses).some(Boolean)).toBe(false);
  });
});

describe("aura commands and lifecycle", () => {
  it("allows exactly one path per tower; the first purchase fixes it", () => {
    const expected = {
      damage: { damage: .55, speed: 0, range: 0 },
      speed: { damage: 0, speed: .5, range: 0 },
      range: { damage: 0, speed: 0, range: .35 },
    };
    for (const path of ["damage", "speed", "range"] as const) {
      const g = fundedGame(), id = g.command({ type: "build", tower: "aura", x: 4, y: 4 }).id!;
      const t = g.state.towers[0];
      expect(towerPath(t)).toBeUndefined();
      expect(g.command({ type: "upgrade", id, upgrade: path }).ok).toBe(true);
      expect(towerPath(t)).toBe(path);
      const gold = g.state.wallets[0];
      for (const other of ["damage", "speed", "range"].filter(p => p !== path))
        for (const upgrade of [other, `${other}-2`, `${other}-3`]) {
          expect(upgradeOption(t, upgrade, Infinity).status).toBe("excluded");
          expect(g.command({ type: "upgrade", id, upgrade })).toMatchObject({ ok: false, code: "upgrade-excluded" });
        }
      expect(g.state.wallets[0]).toBe(gold);
      expect(isFullyUpgraded(t)).toBe(false);
      for (const upgrade of [`${path}-2`, `${path}-3`]) expect(g.command({ type: "upgrade", id, upgrade }).ok).toBe(true);
      expect(auraBonuses(t)).toEqual(expected[path]);
      expect(towerLevel(t)).toBe(1);
      expect(isFullyUpgraded(t)).toBe(true);
    }
  });
  it("offers three path starts, then only the next tier of the chosen path", () => {
    const g = fundedGame(), id = g.command({ type: "build", tower: "aura", x: 4, y: 4 }).id!;
    const t = g.state.towers[0];
    for (const upgrade of ["damage-2", "damage-3", "speed-3", "range-2"])
      expect(g.command({ type: "upgrade", id, upgrade }).ok).toBe(false);
    const start = upgradeControl(t, g.state.towers);
    expect(start.match(/data-upgrade=/g)).toHaveLength(3);
    expect(start).toContain("Locks in the path");
    expect(g.command({ type: "upgrade", id, upgrade: "damage" }).ok).toBe(true);
    const afterFirst = upgradeControl(t, g.state.towers);
    expect(afterFirst.match(/data-upgrade=/g)).toHaveLength(1);
    expect(afterFirst).toContain('data-upgrade="damage-2"');
    expect(afterFirst).toContain("+25% → +40%");
    expect(afterFirst).toContain("--path-color:#ff7a5c");
    for (const upgrade of ["damage-2", "damage-3"]) g.command({ type: "upgrade", id, upgrade });
    const maxed = upgradeControl(t, g.state.towers);
    expect(maxed.match(/data-upgrade=/g)).toHaveLength(1);
    expect(maxed.match(/✓/g)).toHaveLength(1);
    expect(maxed).toContain("Damage III");
    expect(towerDetails("aura", t, g.state.towers)).toContain("PATH DAMAGE · 3 / 3");
  });
  it("takes on the colour of its path", () => {
    const t = tower(1, "aura", 0, 0);
    expect(towerColor(t)).toBe(TOWERS.aura.color);
    expect(towerColor({ ...t, upgrades: ["speed", "speed-2"] })).toBe(0xffd166);
    expect(towerColor(tower(2, "pulse", 0, 0, ["level-2"]))).toBe(TOWERS.pulse.color);
  });
  it("rejects paths without visuals and prerequisites from another path", () => {
    const aura = structuredClone(TOWERS.aura);
    const noVisual = { ...aura, upgrades: aura.upgrades.map(u => u.id === "range" ? { ...u, path: "reach" } : u) };
    expect(() => validateUpgradeDefinitions(noVisual)).toThrow("visual.paths");
    const crossed = { ...aura, upgrades: aura.upgrades.map(u => u.id === "speed-2" ? { ...u, requires: ["damage"] } : u) };
    expect(() => validateUpgradeDefinitions(crossed)).toThrow("another path");
  });
  it("rejects insufficient credits, wrong tower types and invalid upgrade keys atomically", () => {
    const g = new Game(), id = g.command({ type: "build", tower: "aura", x: 4, y: 4 }).id!;
    const before = JSON.stringify(g.state);
    expect(g.command({ type: "upgrade", id, upgrade: "speed" }).ok).toBe(false);
    expect(g.command({ type: "upgrade", id, upgrade: "unknown" }).ok).toBe(false);
    expect(g.command({ type: "upgrade", id, upgrade: "level-2" }).ok).toBe(false);
    expect(JSON.stringify(g.state)).toBe(before);
    const pulse = g.command({ type: "build", tower: "pulse", x: 6, y: 4 }).id!;
    expect(g.command({ type: "upgrade", id: pulse, upgrade: "damage" }).ok).toBe(false);
  });
  it("removes sold bonuses immediately, falls back to weaker auras and refunds all investments", () => {
    const g = fundedGame();
    const p = g.command({ type: "build", tower: "pulse", x: 4, y: 4 }).id!;
    const a = g.command({ type: "build", tower: "aura", x: 3, y: 4 }).id!;
    const b = g.command({ type: "build", tower: "aura", x: 4, y: 5 }).id!;
    for (const upgrade of ["damage", "damage-2"]) g.command({ type: "upgrade", id: a, upgrade });
    g.command({ type: "upgrade", id: b, upgrade: "damage" });
    const target = g.state.towers.find(t => t.id === p)!;
    const before = g.state.wallets[0];
    g.command({ type: "sell", id: a });
    expect(g.state.wallets[0] - before).toBe(308);
    expect(effectiveTowerStats(target, g.state.towers).bonuses).toEqual({ damage: .25, speed: 0, range: 0 });
    g.command({ type: "sell", id: b });
    expect(effectiveTowerStats(target, g.state.towers).damage).toBe(18);
    g.command({ type: "restart" });
    expect(g.state.towers).toEqual([]);
  });
});

describe("combat and interface integration", () => {
  it("support towers do not attack, even with an enemy inside their radius", () => {
    const g = new Game(); g.state.towers = [tower(1, "aura", 0, 0, ["damage", "damage-2", "damage-3"])];
    g.state.enemies = [enemy(1, 0)];
    attackEnemies(g, 1);
    expect(g.state.enemies[0].hp).toBe(1000);
    expect(g.state.events).toEqual([]);
  });
  it("uses aura range and damage in real attacks", () => {
    const g = new Game(), target = tower(1, "pulse", 0, 0);
    g.state.towers = [target]; g.state.enemies = [enemy(3, 0)];
    attackEnemies(g, 1 / 30);
    expect(g.state.enemies[0].hp).toBe(1000);
    g.state.towers.push(tower(2, "aura", 0, 1, ["range"]), tower(3, "aura", 1, 1, ["damage"]));
    attackEnemies(g, 1 / 30);
    expect(g.state.enemies[0].hp).toBe(1000);
    landProjectiles(g);
    expect(g.state.enemies[0].hp).toBe(977.5);
    expect(g.state.events.filter(e => e.type === "shot")).toHaveLength(1);
  });
  it("speed changes preserve attack progress and do not grant a free shot", () => {
    const g = new Game(), target = tower(1, "pulse", 0, 0), source = tower(2, "aura", 1, 0);
    g.state.towers = [target, source]; g.state.enemies = [enemy(1, 0)];
    attackEnemies(g, 0);
    attackEnemies(g, .275);
    expect(target.cooldown).toBeCloseTo(.5);
    source.upgrades.push("speed");
    attackEnemies(g, .1);
    expect(target.cooldown).toBeCloseTo(.5 - .1 / (.55 / 1.2));
    const progress = target.cooldown;
    g.state.towers = [target];
    attackEnemies(g, .1);
    expect(target.cooldown).toBeCloseTo(progress - .1 / .55);
    expect(g.state.events.filter(e => e.type === "shot")).toHaveLength(1);
  });
  it("upgrade previews and selected stats include the same active aura as combat", () => {
    const target = tower(1, "pulse", 1, 0), source = tower(2, "aura", 0, 0, ["damage"]);
    const towers = [target, source], preview = upgradeControl(target, towers);
    expect(preview).toContain("22.5"); // 18 * 1.25
    expect(preview).toContain("37.5"); // next upgrades: ["level-2", "level-3"]0 * 1.25
    expect(towerDetails("pulse", target, towers)).toContain("18 + 4.5 Aura");
    expect(upgradeControl({ ...target, upgrades: ["level-2", "level-3"] }, towers)).toContain("Level 3 → 4");
    expect(upgradeControl({ ...target, upgrades: ["level-2", "level-3", "level-4", "level-5", "overclock-1", "overclock-2", "overclock-3"] }, towers)).toContain("Max level");
    const controls = upgradeControl(source, towers);
    expect((controls.match(/data-upgrade=/g) ?? [])).toHaveLength(1);
    expect(controls).toContain("+25% → +40%"); // tier I owned, tier II offered
    expect(towerDetails("aura", source, towers)).toContain("<b>1</b> tower supported");
  });
});
