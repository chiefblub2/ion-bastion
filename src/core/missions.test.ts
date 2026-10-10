import { describe, it, expect } from "vitest";
import { ENEMIES } from "../content/enemies";
import { MISSIONS, SECTORS, sectorOf } from "../content/missions";
import { Game } from "./game";
import { hasStealth } from "./mission-checks";
import { STRATEGIES } from "./strategies";
import { validateMission } from "./validation";
/** Campaign-wide content rules; the per-mission simulations live in `campaign-tests.ts` (`replay-N.test.ts`). */
describe("missions", () => {
  it("have unique ids and valid content", () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) expect(() => validateMission(m)).not.toThrow();
  });
  it("are grouped into sectors of five plus a final Kreislauf sector, in campaign order", () => {
    expect(SECTORS.length).toBeGreaterThanOrEqual(2);
    const last = SECTORS.at(-1)!;
    for (const s of SECTORS.slice(0, -1)) {
      expect(s.missions).toHaveLength(5);
      expect(s.missions.some((m) => m.circle)).toBe(false);
    }
    expect(last.missions.every((m) => m.circle && m.map.loop)).toBe(true);
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
});
