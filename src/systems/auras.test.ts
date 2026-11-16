import { DEFAULT_CONTENT } from "../content";
import { describe, expect, it } from "vitest";
import { resolveUpgrades, towerColor, validateUpgradeDefinitions } from "../core/upgrades";
import { Game } from "../core/game";
import { TOWERS } from "../content/towers";
import type { Enemy } from "../core/types";
import { auraBonuses, effectiveTowerStats, isInAura, receivedAuraBonuses } from "./auras";
import { attackEnemies } from "./combat";
import { landProjectiles, makeEnemy, towerAt } from "../core/test-helpers";
import { cardChoices, towerCardHtml } from "../ui/tower-card";
import { towerDetails } from "../ui/tower-details";

function enemy(x: number, y: number): Enemy {
  return makeEnemy(100, "tank", x, y, 1);
}
function fundedGame() { const g = new Game(); g.state.wallets[0] = 2000; return g; }

describe("aura rules", () => {
  it("includes the exact radius boundary and excludes diagonal and just-outside targets", () => {
    const source = towerAt(1, "aura", 0, 0, ["damage"]), target = towerAt(2, "pulse", 3, 0);
    expect(isInAura(source, target, DEFAULT_CONTENT)).toBe(true);
    expect(effectiveTowerStats(target, [source, target], DEFAULT_CONTENT).damage).toBeCloseTo(22.5);
    expect(isInAura(source, { ...target, x: 3.0001 }, DEFAULT_CONTENT)).toBe(false);
    expect(isInAura(source, { ...target, x: 2, y: 3 }, DEFAULT_CONTENT)).toBe(false);
  });
  it("takes the strongest bonus independently per property without stacking", () => {
    const target = towerAt(4, "pulse", 1, 1);
    const a = towerAt(1, "aura", 0, 0, ["damage", "damage-2"]);
    const b = towerAt(2, "aura", 2, 0, ["speed"]);
    const c = towerAt(3, "aura", 1, 0, ["range"]);
    const d = towerAt(5, "aura", 2, 1, ["damage"]);
    expect(receivedAuraBonuses(target, [a, b, c, d], DEFAULT_CONTENT)).toEqual({ damage: .4, speed: .2, range: .15 });
    expect(receivedAuraBonuses(target, [d, c, b, a], DEFAULT_CONTENT)).toEqual(receivedAuraBonuses(target, [a, b, c, d], DEFAULT_CONTENT));
  });
  it("applies bonuses after normal upgrades without altering source content or special effects", () => {
    const before = JSON.stringify(TOWERS);
    const sources = [towerAt(1, "aura", 0, 0, ["damage"]), towerAt(3, "aura", 0, 1, ["speed"]), towerAt(4, "aura", 1, 1, ["range"])];
    for (const type of ["pulse", "blast", "frost"] as const) {
      const target = { ...towerAt(2, type, 1, 0), upgrades: ["level-2", "level-3"] };
      const stats = effectiveTowerStats(target, [...sources, target], DEFAULT_CONTENT), base = resolveUpgrades({ type, upgrades: ["level-2", "level-3"] }, DEFAULT_CONTENT).stats;
      expect(stats.damage).toBeCloseTo(base.damage * 1.25);
      expect(stats.range).toBeCloseTo(base.range * 1.15);
      expect(stats.interval).toBeCloseTo(base.interval / 1.2);
    }
    expect(JSON.stringify(TOWERS)).toBe(before);
  });
  it("never buffs an aura tower or propagates through another aura", () => {
    const a = towerAt(1, "aura", 0, 0, ["range", "range-2"]);
    const b = towerAt(2, "aura", 2, 0, ["damage"]);
    const target = towerAt(3, "pulse", 5, 0);
    expect(receivedAuraBonuses(b, [a, b], DEFAULT_CONTENT)).toEqual({ damage: 0, speed: 0, range: 0 });
    expect(effectiveTowerStats(b, [a, b], DEFAULT_CONTENT).range).toBe(3);
    expect(receivedAuraBonuses(target, [a, b], DEFAULT_CONTENT)).toEqual({ damage: .25, speed: 0, range: 0 });
  });
  it("has no base bonus: an aura without a path boosts nothing", () => {
    const source = towerAt(1, "aura", 0, 0), target = towerAt(2, "pulse", 1, 0);
    expect(auraBonuses(source, DEFAULT_CONTENT)).toEqual({ damage: 0, speed: 0, range: 0 });
    expect(effectiveTowerStats(target, [source, target], DEFAULT_CONTENT).damage).toBe(18);
    expect(Object.values(effectiveTowerStats(target, [source, target], DEFAULT_CONTENT).bonuses).some(Boolean)).toBe(false);
  });
});

describe("aura commands and lifecycle", () => {
  it("rejects another track's upgrade as a command without charging, and keeps the chosen track", () => {
    for (const track of ["damage", "speed", "range"] as const) {
      const g = fundedGame(), id = g.command({ type: "build", tower: "aura", x: 4, y: 4 }).id!;
      const t = g.state.towers[0];
      expect(g.command({ type: "upgrade", id, upgrade: track }).ok).toBe(true);
      const gold = g.state.wallets[0];
      for (const other of ["damage", "speed", "range"].filter(p => p !== track))
        for (const upgrade of [other, `${other}-2`, `${other}-3`])
          expect(g.command({ type: "upgrade", id, upgrade })).toMatchObject({ ok: false, code: "upgrade-excluded" });
      expect(g.state.wallets[0]).toBe(gold);
      for (const upgrade of [`${track}-2`, `${track}-3`]) expect(g.command({ type: "upgrade", id, upgrade }).ok).toBe(true);
      // A track's tier holds its final value.
      const top = TOWERS.aura.upgrades.find(u => u.id === `${track}-3`)!.effects.aura!;
      expect(auraBonuses(t, DEFAULT_CONTENT)).toEqual({ damage: 0, speed: 0, range: 0, ...top });
    }
  });
  it("offers three track starts, then only the next tier of the chosen track", () => {
    const g = fundedGame(), id = g.command({ type: "build", tower: "aura", x: 4, y: 4 }).id!;
    const t = g.state.towers[0];
    for (const upgrade of ["damage-2", "damage-3", "speed-3", "range-2"])
      expect(g.command({ type: "upgrade", id, upgrade }).ok).toBe(false);
    const offered = () => cardChoices(t, g.state.towers, Infinity);
    expect(offered().map((c) => c.branch?.kind)).toEqual(["track", "track", "track"]);
    expect(g.command({ type: "upgrade", id, upgrade: "damage" }).ok).toBe(true);
    expect(offered().map((c) => c.id)).toEqual(["damage-2"]);
    for (const upgrade of ["damage-2", "damage-3"]) g.command({ type: "upgrade", id, upgrade });
    // Tier III owned, then the three paths on offer.
    expect(offered()).toHaveLength(3);
    expect(offered().map((c) => c.id)).toContain("harmonics-1");
    expect(offered().every((c) => c.branch?.kind === "path")).toBe(true);
    expect(towerDetails("aura", t, g.state.towers)).toContain("LEVEL 4 / 7 · DAMAGE");
  });
  it("takes on the colour of its track", () => {
    const t = towerAt(1, "aura", 0, 0);
    expect(towerColor(t, DEFAULT_CONTENT)).toBe(TOWERS.aura.color);
    expect(towerColor({ ...t, upgrades: ["speed", "speed-2"] }, DEFAULT_CONTENT)).toBe(TOWERS.aura.visual.tracks!.speed!.color);
    expect(towerColor(towerAt(2, "pulse", 0, 0, ["level-2"]), DEFAULT_CONTENT)).toBe(TOWERS.pulse.color);
  });
  it("rejects tracks without visuals and prerequisites from another track", () => {
    const aura = structuredClone(TOWERS.aura);
    const noVisual = { ...aura, upgrades: aura.upgrades.map(u => u.id === "range" ? { ...u, track: "reach" } : u) };
    expect(() => validateUpgradeDefinitions(noVisual)).toThrow("visual.tracks");
    const crossed = { ...aura, upgrades: aura.upgrades.map(u => u.id === "speed-2" ? { ...u, requires: ["damage"] } : u) };
    expect(() => validateUpgradeDefinitions(crossed)).toThrow("another track");
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
    expect(effectiveTowerStats(target, g.state.towers, DEFAULT_CONTENT).bonuses).toEqual({ damage: .25, speed: 0, range: 0 });
    g.command({ type: "sell", id: b });
    expect(effectiveTowerStats(target, g.state.towers, DEFAULT_CONTENT).damage).toBe(18);
    g.command({ type: "restart" });
    expect(g.state.towers).toEqual([]);
  });
});

describe("combat and interface integration", () => {
  it("support towers do not attack, even with an enemy inside their radius", () => {
    const g = new Game(); g.state.towers = [towerAt(1, "aura", 0, 0, ["damage", "damage-2", "damage-3"])];
    g.state.enemies = [enemy(1, 0)];
    attackEnemies(g, 1);
    expect(g.state.enemies[0].hp).toBe(1000);
    expect(g.state.events).toEqual([]);
  });
  it("uses aura range and damage in real attacks", () => {
    const g = new Game(), target = towerAt(1, "pulse", 0, 0);
    g.state.towers = [target]; g.state.enemies = [enemy(3, 0)];
    attackEnemies(g, 1 / 30);
    expect(g.state.enemies[0].hp).toBe(1000);
    g.state.towers.push(towerAt(2, "aura", 0, 1, ["range"]), towerAt(3, "aura", 1, 1, ["damage"]));
    attackEnemies(g, 1 / 30);
    expect(g.state.enemies[0].hp).toBe(1000);
    landProjectiles(g);
    expect(g.state.enemies[0].hp).toBe(977.5);
    expect(g.state.events.filter(e => e.type === "shot")).toHaveLength(1);
  });
  it("speed changes preserve attack progress and do not grant a free shot", () => {
    const g = new Game(), target = towerAt(1, "pulse", 0, 0), source = towerAt(2, "aura", 1, 0);
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
    const target = towerAt(1, "pulse", 1, 0), source = towerAt(2, "aura", 0, 0, ["damage"]);
    const towers = [target, source],
      damage = cardChoices(target, towers, Infinity)[0].changes.find((c) => c.label === "Damage")!;
    expect(damage.before).toBeCloseTo(22.5); // 18 * 1.25
    expect(damage.after).toBeCloseTo(37.5); // level 2: 30 * 1.25
    expect(towerDetails("pulse", target, towers)).toContain("18 <b>+ 4.5 Aura</b>");
    expect(cardChoices({ ...target, upgrades: ["level-2", "level-3"] }, towers, Infinity)[0].label).toBe("Upgrade → Lv 4");
    expect(towerCardHtml({ ...target, upgrades: ["level-2", "level-3", "level-4", "level-5", "overclock-1", "overclock-2", "overclock-3"] }, towers, { credits: 0, slim: false })).toContain("Max level");
    const controls = cardChoices(source, towers, Infinity);
    expect(controls).toHaveLength(1);
    expect(controls[0].changes).toEqual([expect.objectContaining({ before: 25, after: 40, unit: "%" })]); // tier I owned, tier II offered
    expect(towerDetails("aura", source, towers)).toContain("<b>1</b> tower supported");
  });
});
