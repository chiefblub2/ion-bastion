import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { validateMission } from "../core/validation";
import { BOSS_MOD_IDS } from "./boss";
import { runMission } from "./generate";
import { actMap } from "./map";
import { RANK_XP } from "./tuning";
import { RELIC_IDS, relicOf, relicsOf, signatureOf } from "./relics";
import { chooseStarter, continueRun, gainRelic, newRun, pickRelic, signatureOffer, type RunState } from "./run";
import { tagsOf } from "./tags";
const content = DEFAULT_CONTENT;
/** A run standing before a node of each act, with a broad roster, every relic or modifier applied in turn. */
function sample(act: number): RunState {
  const run = chooseStarter(newRun(21), 0);
  return { ...run, act, roster: ["pulse", "blast", "frost", "tesla", "detector", "mine", "inferno", "plasma", "aura"], doctrines: ["pulse:" + "x"] };
}
describe("run relics and modifiers", () => {
  it("every relic yields valid missions in every act", () => {
    for (const id of RELIC_IDS)
      for (let act = 0; act < 4; act++) {
        const run = gainRelic({ ...sample(act), doctrines: [] }, id),
          node = actMap(run.seed, act, content).flat().find((n) => n.mission)!,
          { mission, content: pack } = runMission(run, node, content);
        expect(() => validateMission(mission, pack), `${id} in act ${act + 1}`).not.toThrow();
      }
    expect(relicOf("glass").rarity).toBe("cursed");
  });
  it("every boss modifier yields valid boss missions, and ranks change only roster towers", () => {
    for (const mod of BOSS_MOD_IDS)
      for (let act = 0; act < 3; act++) {
        const run = { ...sample(act), doctrines: [], ranks: { pulse: RANK_XP[3] } },
          boss = { ...actMap(run.seed, act, content)[4][0], mods: [mod] },
          { mission, content: pack } = runMission(run, boss, content);
        expect(() => validateMission(mission, pack), `${mod} in act ${act + 1}`).not.toThrow();
        expect(pack.towers.pulse.damage).toBeGreaterThan(content.towers.pulse.damage);
        expect(pack.towers.flak.damage).toBe(content.towers.flak.damage);
      }
  });
  it("carries combat relics into the mission as protocols, Unstable Reactor scaled to the run's reactor", () => {
    const run = gainRelic(gainRelic({ ...sample(1), doctrines: [] }, "fracture"), "unstable"),
      node = actMap(run.seed, 1, content).flat().find((n) => n.mission)!,
      { mission } = runMission(run, node, content);
    expect(mission.protocols?.fracture).toEqual({ slowAt: 0.7, bonus: 0.4 });
    expect(mission.protocols?.unstable?.reactorMax).toBe(run.reactorMax);
    expect(run.reactorMax).toBe(Math.round(30 * 0.75));
    expect(runMission({ ...sample(1), doctrines: [] }, node, content).mission.protocols).toBeUndefined();
  });
  it("offers a boss's signature relic at its act transition only, when the roster can use it", () => {
    for (const mod of BOSS_MOD_IDS) {
      const id = signatureOf(mod)!;
      expect(relicOf(id).rarity).toBe("signature");
      for (const rarity of ["common", "rare", "legendary", "cursed"] as const) expect(relicsOf(rarity)).not.toContain(id);
    }
    const boss = { ...actMap(21, 0, content)[4][0], mods: ["iron" as const] },
      base: RunState = { ...sample(0), doctrines: [], phase: "reward", node: boss, log: [] };
    // Blast deals area damage: the Armorbreaker Matrix leads the act's relics.
    const act = continueRun(base, content);
    expect(act.offers.legendary?.[0]).toBe("armorbreaker");
    expect(act.offers.legendary).toHaveLength(3);
    expect(new Set(act.offers.legendary).size).toBe(3);
    // Without an area tower the Matrix could never act, so three legendary relics come instead.
    const plain = continueRun({ ...base, roster: ["pulse", "frost"] }, content);
    expect(plain.offers.legendary).not.toContain("armorbreaker");
    // Taken once, it is never offered again, and the transition stays one exclusive choice.
    const taken = pickRelic(act, "legendary", "armorbreaker");
    expect(taken.relics).toContain("armorbreaker");
    expect(taken.offers.doctrine).toBeUndefined();
    expect(signatureOffer({ ...taken, phase: "reward", node: boss }, content)).toBeUndefined();
  });
  it("tags every tower", () => {
    for (const t of Object.values(content.towers)) expect(tagsOf(t).length, t.id).toBeGreaterThan(0);
  });
});
