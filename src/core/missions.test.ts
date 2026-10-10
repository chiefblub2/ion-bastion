import { describe, it, expect } from "vitest";
import { ENEMIES } from "../content/enemies";
import { MISSIONS, SECTORS, missionById, sectorOf } from "../content/missions";
import { Game } from "./game";
import { play } from "./test-helpers";
import { hasAir, hasStealth, isTutorial, novaOnly, thinBuilds, unbuildable } from "./mission-checks";
import { STRATEGIES } from "./strategies";
import { validateMission } from "./validation";
/** Strategies that still lose; balancing is pending. Remove an entry once it wins. */
const PENDING_BALANCE = new Set(["frostwall/A", "frostwall/B"]);
describe("missions", () => {
  it("have unique ids and valid content", () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) expect(() => validateMission(m)).not.toThrow();
  });
  it("are grouped into eight sectors of five plus the Kreislauf sector, in campaign order", () => {
    expect(SECTORS.map((s) => s.missions.length)).toEqual([5, 5, 5, 5, 5, 5, 5, 5, 3]);
    expect(SECTORS.at(-1)!.missions.every((m) => m.circle && m.map.loop)).toBe(true);
    expect(SECTORS.flatMap((s) => s.missions)).toEqual(MISSIONS);
    expect(new Set(SECTORS.map((s) => s.id)).size).toBe(SECTORS.length);
    expect(sectorOf(MISSIONS[5])).toBe(SECTORS[1]);
  });
  it("switching resets to the new mission; restart keeps it", () => {
    const g = new Game();
    g.command({ type: "build", tower: "pulse", x: 4, y: 4 });
    expect(g.command({ type: "mission", id: "kernfestung" }).ok).toBe(true);
    expect(g.mission.id).toBe("kernfestung");
    expect(g.state.wallets[0]).toBe(400);
    expect(g.state.lives).toBe(20);
    expect(g.state.towers).toHaveLength(0);
    g.command({ type: "restart" });
    expect(g.mission.id).toBe("kernfestung");
    expect(g.command({ type: "mission", id: "nope" }).ok).toBe(false);
  });
  it("stealth only where the detector can be built", () => {
    for (const m of MISSIONS.filter((m) => hasStealth(m))) expect(!m.availableTowers || m.availableTowers.includes("detector")).toBe(true);
  });
  it("defense A builds a detector against stealth", () => {
    for (const m of MISSIONS.filter((m) => hasStealth(m))) expect(STRATEGIES[m.id].A.builds.some((b) => b.tower === "detector")).toBe(true);
  });
  it("sector I keeps the base roster", () => {
    const base = new Set(["drone", "runner", "tank", "boss", "glider"]);
    for (const m of SECTORS[0].missions) for (const w of m.waves) for (const g of w.groups) expect(base.has(g.type)).toBe(true);
  });
  it("every enemy type appears in the campaign", () => {
    const used = new Set(MISSIONS.flatMap((m) => m.waves.flatMap((w) => w.groups.map((g) => g.type))));
    for (const id of Object.keys(ENEMIES)) expect(used.has(id as keyof typeof ENEMIES)).toBe(true);
  });
  for (const m of MISSIONS) {
    describe(m.name, () => {
      it("is lost without any defense", () => {
        const { game } = play(m);
        expect(game.state.status).toBe("lost");
        // A ring has no reactor: the enemy limit ends it instead.
        if (m.circle) expect(game.state.enemies.length).toBeGreaterThan(m.circle.limit);
        else expect(game.state.lives).toBe(0);
        expect(game.command({ type: "build", tower: "pulse", x: 0, y: 0 }).ok).toBe(false);
      });
      if (hasAir(m))
        it("is lost with a ground-only Nova defense", () => {
          const builds = novaOnly(STRATEGIES[m.id].A);
          const { game } = play(m, { builds });
          expect(game.state.status).toBe("lost");
        });
      // On a ring every shot eventually finds a target, so a few fully upgraded towers
      // are a legitimate tactic there; a single tower must still fall short.
      if (m.circle)
        it("is lost with a single tower", () => {
          const { game } = play(m, { builds: thinBuilds(m, STRATEGIES[m.id].A) });
          expect(game.state.status).toBe("lost");
        });
      // Mission 01 is the tutorial: three upgraded towers are meant to suffice.
      else if (!isTutorial(m))
        it("is lost with a thin defense of three towers", () => {
          const { game } = play(m, { builds: thinBuilds(m, STRATEGIES[m.id].A) });
          expect(game.state.status).toBe("lost");
        });
      for (const key of ["A", "B"] as const) {
        it.skipIf(PENDING_BALANCE.has(`${m.id}/${key}`))(`can be won with defense ${key}`, () => {
          const strategy = STRATEGIES[m.id]?.[key];
          expect(strategy).toBeDefined();
          expect(unbuildable(missionById(m.id)!, strategy)).toEqual([]);
          const { game } = play(m, strategy);
          expect(game.state.status).toBe("won");
          expect(game.state.lives).toBeGreaterThan(0);
        });
      }
    });
  }
});
