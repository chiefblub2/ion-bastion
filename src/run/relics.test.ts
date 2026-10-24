import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { validateMission } from "../core/validation";
import { BOSS_MOD_IDS } from "./boss";
import { runMission } from "./generate";
import { actMap } from "./map";
import { RANK_XP } from "./tuning";
import { RELIC_IDS, relicOf } from "./relics";
import { chooseStarter, gainRelic, newRun, type RunState } from "./run";
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
  it("tags every tower", () => {
    for (const t of Object.values(content.towers)) expect(tagsOf(t).length, t.id).toBeGreaterThan(0);
  });
});
