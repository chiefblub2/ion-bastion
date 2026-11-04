import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy, place } from "../core/test-helpers";
import type { Tower, TowerId } from "../core/types";
import { isFullyUpgraded, towerLevel, towerPath, towerTrack, upgradeOption } from "../core/upgrades";
import { lockSpecializations } from "../run/transform";
import { receivedAuraBonuses } from "./auras";
import { applyDamage, hitOf } from "./damage";

const DAMAGE = ["damage", "damage-2", "damage-3"];
const aura = (upgrades: string[]) => ({ type: "aura" as TowerId, upgrades });
/** Damage a 1000-HP enemy of `type` takes from one 100-damage hit of `tower`. */
function hit(g: Game, tower: Tower, type: "scarab" | "tank" = "tank", hp = 1000) {
  const e = { ...makeEnemy(g.state.nextId++, type, tower.x + 0.5, tower.y), hp };
  g.state.enemies = [e];
  const src = { tower: tower.id, type: tower.type };
  applyDamage(g, src, e, 100, false, hitOf("direct", src));
  return hp - e.hp;
}

describe("Aura tracks and paths", () => {
  it("excludes tracks and paths independently, and opens the paths only from a track's tier III (level 4)", () => {
    expect(upgradeOption(aura([]), "harmonics-1", Infinity, DEFAULT_CONTENT).status).toBe("locked");
    expect(upgradeOption(aura(["speed", "speed-2"]), "harmonics-1", Infinity, DEFAULT_CONTENT).status).toBe("locked");
    for (const track of ["damage", "speed", "range"]) {
      const t = aura([track, `${track}-2`, `${track}-3`]);
      expect(towerLevel(t, DEFAULT_CONTENT)).toBe(4);
      expect(upgradeOption(t, "piercing-field-1", Infinity, DEFAULT_CONTENT).status).toBe("available");
    }
    for (const track of ["damage", "speed", "range"]) {
      const t = aura([track]);
      expect([towerTrack(t, DEFAULT_CONTENT), towerPath(t, DEFAULT_CONTENT)]).toEqual([track, undefined]);
      for (const other of ["damage", "speed", "range"].filter((o) => o !== track))
        for (const upgrade of [other, `${other}-2`, `${other}-3`]) expect(upgradeOption(t, upgrade, Infinity, DEFAULT_CONTENT).status).toBe("excluded");
      // The paths open after tier III, so a tier-III Aura is not fully upgraded yet.
      expect(isFullyUpgraded(aura([track, `${track}-2`, `${track}-3`]), DEFAULT_CONTENT)).toBe(false);
    }
    const t = aura([...DAMAGE, "harmonics-1"]);
    expect([towerTrack(t, DEFAULT_CONTENT), towerPath(t, DEFAULT_CONTENT), towerLevel(t, DEFAULT_CONTENT)]).toEqual(["damage", "harmonics", 5]);
    expect(upgradeOption(t, "speed", Infinity, DEFAULT_CONTENT).status).toBe("excluded");
    expect(upgradeOption(t, "execution-field-1", Infinity, DEFAULT_CONTENT).status).toBe("excluded");
    expect(upgradeOption(t, "harmonics-2", Infinity, DEFAULT_CONTENT).status).toBe("available");
  });
  it("keeps the tracks in a Run and drops the paths without a Doctrine", () => {
    const locked = lockSpecializations([])(DEFAULT_CONTENT).towers.aura;
    expect(locked.upgrades.map((u) => u.id)).toEqual(DEFAULT_CONTENT.towers.aura.upgrades.filter((u) => u.track).map((u) => u.id));
    expect(Object.keys(locked.visual.tracks ?? {})).toEqual(["damage", "speed", "range"]);
    expect(locked.visual.paths).toBeUndefined();
    const held = lockSpecializations(["aura:harmonics"])(DEFAULT_CONTENT).towers.aura;
    expect(Object.keys(held.visual.paths ?? {})).toEqual(["harmonics"]);
  });
});

describe("Harmonics", () => {
  it("adds the two other stats, never above the track bonus, and never to traps or support towers", () => {
    const g = new Game(),
      source = place(g, "aura", 5, 5, [...DAMAGE, "harmonics-1", "harmonics-2", "harmonics-3"]),
      pulse = place(g, "pulse", 6, 5),
      vault = place(g, "vault", 5, 6),
      mine = place(g, "mine", 4, 5);
    expect(receivedAuraBonuses(pulse, g.state.towers, DEFAULT_CONTENT)).toEqual({ damage: 0.55, speed: 0.1, range: 0.1 });
    expect(receivedAuraBonuses(vault, g.state.towers, DEFAULT_CONTENT)).toEqual({ damage: 0, speed: 0, range: 0 });
    expect(receivedAuraBonuses(mine, g.state.towers, DEFAULT_CONTENT).speed).toBe(0);
    // Overlap: the strongest Aura per stat, so a speed-track Aura wins the speed stat.
    place(g, "aura", 7, 5, ["speed"]);
    expect(receivedAuraBonuses(pulse, g.state.towers, DEFAULT_CONTENT)).toEqual({ damage: 0.55, speed: 0.2, range: 0.1 });
    // A bonus above the track's own value is capped by it.
    const content = structuredClone(DEFAULT_CONTENT),
      tier = content.towers.aura.upgrades.find((u) => u.id === "harmonics-3")!;
    tier.effects.specialization = { kind: "harmonics", bonus: 0.9 };
    expect(receivedAuraBonuses(pulse, [source, pulse], content)).toEqual({ damage: 0.55, speed: 0.55, range: 0.55 });
  });
});

describe("Piercing Field", () => {
  it("lets supported hits ignore armor; with an Armory the higher pierce counts", () => {
    const g = new Game(),
      pulse = place(g, "pulse", 5, 6),
      armor = DEFAULT_CONTENT.enemies.scarab.traits!.find((t) => t.kind === "armor")! as { reduction: number };
    expect(hit(g, pulse, "scarab")).toBeCloseTo(100 * (1 - armor.reduction));
    place(g, "aura", 5, 5, [...DAMAGE, "piercing-field-1", "piercing-field-2", "piercing-field-3"]);
    expect(hit(g, pulse, "scarab")).toBeCloseTo(100 * (1 - armor.reduction * 0.8));
    place(g, "armory", 4, 6);
    expect(hit(g, pulse, "scarab")).toBeCloseTo(100 * (1 - armor.reduction * 0.5));
  });
});

describe("Execution Field", () => {
  it("adds damage only below the HP threshold, judged on impact, and only for supported towers", () => {
    const g = new Game(),
      near = place(g, "pulse", 5, 6),
      far = place(g, "pulse", 12, 12);
    place(g, "aura", 5, 5, [...DAMAGE, "execution-field-1"]);
    expect(hit(g, near, "tank", 1000)).toBeCloseTo(100);
    expect(hit(g, near, "tank", 300)).toBeCloseTo(100);
    expect(hit(g, near, "tank", 299)).toBeCloseTo(110);
    expect(hit(g, far, "tank", 299)).toBeCloseTo(100);
  });
});
