import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import type { DamageSource, Tower, TowerId } from "../core/types";
import { effectiveTowerStats } from "./auras";
import { chargedFactor, critRider, downlinkFactor, nexusBoost, openSalvos, pathsFactor, resetSalvos } from "./combat-paths-b";
import { attackEnemies } from "./combat";
import { applyDamage, hitOf } from "./damage";
import { speedFactor } from "./status";
import { overclockRate } from "./support";
/** Level 3 plus `tier` tiers of the path `slug`. */
const path = (slug?: string, tier = 3) => ["level-2", "level-3", ...(slug ? Array.from({ length: tier }, (_, i) => `${slug}-${i + 1}`) : [])];
function place(g: Game, type: TowerId, x: number, y: number, upgrades: string[] = []) {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(t);
  return t;
}
const source = (t: Tower, crit?: DamageSource["crit"]): DamageSource => ({ tower: t.id, type: t.type, ...(crit ? { crit } : {}) });

describe("Overclock paths", () => {
  it("Afterburn fades a 40% boost out over its duration after each window", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6),
      oc = place(g, "overclock", 5, 5, path("afterburn"));
    g.state.time = 1;
    expect(overclockRate(g, t)).toBe(2.5);
    g.state.time = 14.5;
    expect(overclockRate(g, t)).toBeCloseTo(1.3);
    g.state.time = 17;
    expect(overclockRate(g, t)).toBe(1);
    oc.upgrades = path();
    g.state.time = 14.5;
    expect(overclockRate(g, t)).toBe(1);
  });
  it("Opening Salvo opens once per wave when the first enemy enters the radius", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6),
      oc = place(g, "overclock", 5, 5, path("opening-salvo", 1));
    g.state.time = 5;
    openSalvos(g);
    expect(oc.salvo).toBeUndefined();
    g.state.enemies = [makeEnemy(1, "tank", 6, 5)];
    openSalvos(g);
    expect(oc.salvo).toBe(5);
    g.state.time = 6.5;
    expect(overclockRate(g, t)).toBe(2.5);
    g.state.time = 7.5;
    expect(overclockRate(g, t)).toBe(1);
    g.state.time = 15;
    openSalvos(g);
    expect(oc.salvo).toBe(5);
    resetSalvos(g);
    expect(oc.salvo).toBeUndefined();
  });
  it("Charged Rounds strengthens shots fired during the window, judged at fire time", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6);
    place(g, "overclock", 5, 5, path("charged-rounds"));
    g.state.time = 1;
    expect(chargedFactor(g, t)).toBeCloseTo(1.16);
    g.state.enemies = [makeEnemy(1, "tank", 5.5, 6.5)];
    attackEnemies(g, 1 / 30);
    expect(g.state.projectiles[0].damage).toBeCloseTo(g.content.towers.pulse.damage * 1.16);
    g.state.time = 5;
    expect(chargedFactor(g, t)).toBe(1);
  });
});

describe("Fire Control paths", () => {
  it("Penetrator rides on the crit's projectile and ignores 70% of the armor", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6);
    place(g, "firectl", 5, 5, path("penetrator"));
    t.critCount = 2;
    const e = makeEnemy(1, "scarab", 5.5, 6.5);
    g.state.enemies = [e];
    attackEnemies(g, 1 / 30);
    expect(g.state.projectiles[0].crit).toEqual({ pierce: 0.7 });
    landProjectiles(g);
    expect(1000 - e.hp).toBeCloseTo(g.content.towers.pulse.damage * 3 * (1 - 0.3 * 0.3));
    // The next shot is no crit and carries nothing.
    t.cooldown = 0;
    attackEnemies(g, 1 / 30);
    expect(g.state.projectiles[0].crit).toBeUndefined();
  });
  it("Stagger slows a crit's target through the normal slow", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6),
      e = makeEnemy(1, "tank", 6, 6);
    place(g, "firectl", 5, 5, path("stagger"));
    const crit = critRider(g, t)!;
    expect(crit).toEqual({ slow: 0.3, duration: 1 });
    applyDamage(g, source(t, crit), e, 10, false, hitOf("direct", source(t, crit)));
    expect(speedFactor(e, g.state.time + 0.5)).toBeCloseTo(0.7);
    expect(speedFactor(e, g.state.time + 1.5)).toBe(1);
  });
  it("Spotting: the next hit by another tower deals 20% more and consumes the mark", () => {
    const g = new Game(),
      a = place(g, "pulse", 5, 6),
      b = place(g, "pulse", 6, 6),
      e = makeEnemy(1, "tank", 6, 7);
    place(g, "firectl", 5, 5, path("spotting"));
    const crit = critRider(g, a)!;
    applyDamage(g, source(a, crit), e, 10, false, hitOf("direct", source(a, crit)));
    expect(e.spotted).toEqual({ by: a.id, bonus: 0.2 });
    // The spotter's own hits and dots leave the mark.
    applyDamage(g, source(a), e, 10, false, hitOf("direct", source(a)));
    applyDamage(g, source(b), e, 10, true);
    expect(e.spotted).toBeDefined();
    const hp = e.hp;
    applyDamage(g, source(b), e, 10, false, hitOf("direct", source(b)));
    expect(hp - e.hp).toBeCloseTo(12);
    expect(e.spotted).toBeUndefined();
  });
});

describe("Skylink paths", () => {
  it("Downlink slows held flyers only", () => {
    const g = new Game(),
      held = makeEnemy(1, "glider", 5, 6),
      free = makeEnemy(2, "glider", 12, 12),
      walker = makeEnemy(3, "tank", 5, 6);
    place(g, "skylink", 5, 5, path("downlink"));
    expect(downlinkFactor(g, held)).toBeCloseTo(0.8);
    expect(downlinkFactor(g, free)).toBe(1);
    expect(downlinkFactor(g, walker)).toBe(1);
  });
  it("Flak Relay helps anti-air towers in its radius, Wing Tag every source on held flyers", () => {
    const g = new Game(),
      flak = place(g, "flak", 5, 6),
      mortar = place(g, "mortar", 6, 5),
      held = makeEnemy(1, "glider", 5, 4),
      sky = place(g, "skylink", 5, 5, path("flak-relay"));
    expect(pathsFactor(g, source(flak), held, false)).toBeCloseTo(1.1);
    expect(pathsFactor(g, source(flak), held, true)).toBe(1);
    expect(pathsFactor(g, source(mortar), held, false)).toBe(1);
    sky.upgrades = path("wing-tag");
    expect(pathsFactor(g, source(mortar), held, false)).toBeCloseTo(1.1);
    expect(pathsFactor(g, source(mortar), held, true)).toBeCloseTo(1.1);
    expect(pathsFactor(g, source(mortar), makeEnemy(2, "tank", 5, 4), false)).toBe(1);
  });
});

describe("Nexus paths", () => {
  it("Resonance and Harmony add range and fire rate per tower type, only with the simulation", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6),
      nexus = place(g, "nexus", 5, 5, path("resonance"));
    place(g, "blast", 4, 5);
    const base = g.content.towers.pulse;
    expect(effectiveTowerStats(t, g.state.towers, g.content, g).range).toBeCloseTo(base.range * 1.04);
    expect(effectiveTowerStats(t, g.state.towers, g.content).range).toBeCloseTo(base.range);
    nexus.upgrades = path("harmony");
    expect(nexusBoost(g, t)).toEqual({ range: 0, rate: 0.04 });
    expect(effectiveTowerStats(t, g.state.towers, g.content, g).interval).toBeCloseTo(base.interval / 1.04);
  });
  it("Diversity needs 5 tower types in the radius", () => {
    const g = new Game(),
      e = makeEnemy(1, "tank", 5, 6),
      src = source(place(g, "pulse", 5, 4));
    place(g, "nexus", 5, 5, path("diversity"));
    (["blast", "flak", "tesla"] as TowerId[]).forEach((type, i) => place(g, type, 4 + i, 7));
    expect(pathsFactor(g, src, e, false)).toBe(1);
    place(g, "frost", 6, 5);
    expect(pathsFactor(g, src, e, true)).toBeCloseTo(1.1);
  });
});

describe("boards without these paths", () => {
  it("behave as before: no rider, no salvo, no factors", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6),
      e = makeEnemy(1, "glider", 5, 6.5);
    for (const type of ["overclock", "firectl", "skylink", "nexus"] as TowerId[]) place(g, type, 5, 5, path());
    place(g, "blast", 4, 5);
    t.critCount = 2;
    g.state.enemies = [e];
    g.state.time = 1;
    openSalvos(g);
    attackEnemies(g, 1 / 30);
    const shot = g.state.projectiles[0];
    expect(shot.crit).toBeUndefined();
    expect(g.state.towers.some((o) => o.salvo !== undefined)).toBe(false);
    expect(critRider(g, t)).toBeUndefined();
    expect(chargedFactor(g, t)).toBe(1);
    expect(downlinkFactor(g, e)).toBe(1);
    expect(pathsFactor(g, source(t), e, false)).toBe(1);
    expect(nexusBoost(g, t)).toEqual({ range: 0, rate: 0 });
    landProjectiles(g);
    expect(e.spotted).toBeUndefined();
  });
});
