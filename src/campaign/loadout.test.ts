import { describe, expect, it } from "vitest";
import { CORE_KIT, LOADOUT } from "../content/arsenal";
import { DEFAULT_CONTENT } from "../content/index";
import { MISSIONS, SECTORS } from "../content/missions";
import { availableTowers } from "../core/game";
import { hasStealth } from "../core/mission-checks";
import type { MissionDefinition, TowerId } from "../core/types";
import { answers, missionNeeds } from "../run/threats";
import { type Arsenal, EMPTY_ARSENAL, owns } from "./arsenal";
import { autoLoadout, fieldedTowers, kitOf, nextSlot, slotsOf, validLoadout } from "./loadout";
import type { CampaignRecord } from "./record";

const content = DEFAULT_CONTENT,
  won = (...ms: MissionDefinition[]): CampaignRecord => Object.fromEntries(ms.map((m) => [m.id, 1])),
  finale = (i: number) => SECTORS[i].missions.at(-1)!,
  rich: Arsenal = { ...EMPTY_ARSENAL, researched: (Object.keys(content.towers) as TowerId[]).filter((id) => !CORE_KIT.includes(id)) },
  campaign = MISSIONS.filter((m) => !m.circle);

describe("loadout slots", () => {
  it("only the listed finales add a slot", () => {
    expect(slotsOf({})).toBe(LOADOUT.base);
    expect(slotsOf(won(finale(LOADOUT.finales[0])))).toBe(LOADOUT.base + 1);
    const other = SECTORS.findIndex((s, i) => !(LOADOUT.finales as readonly number[]).includes(i));
    expect(slotsOf(won(finale(other)))).toBe(LOADOUT.base);
    expect(slotsOf(won(...SECTORS.map((_, i) => finale(i))))).toBe(Math.min(LOADOUT.max, LOADOUT.base + LOADOUT.finales.length));
    expect(nextSlot({})?.index).toBe(LOADOUT.finales[0]);
    expect(nextSlot(won(finale(LOADOUT.finales[0])))?.index).toBe(LOADOUT.finales[1]);
  });
});

describe("kit", () => {
  it("the pool is owned ∩ allowed; the Detector is issued without a slot", () => {
    for (const m of campaign) {
      const kit = kitOf(m, EMPTY_ARSENAL, {}, content),
        allowed = availableTowers(m, content);
      if (!kit.special) for (const id of kit.pool) expect(owns(EMPTY_ARSENAL, id) && allowed.includes(id), `${m.id} ${id}`).toBe(true);
      expect(kit.pool).not.toContain("detector");
      expect(kit.issued.includes("detector")).toBe(hasStealth(m, content) && allowed.includes("detector"));
    }
    const stealth = campaign.find((m) => hasStealth(m, content) && !m.availableTowers)!,
      kit = kitOf(stealth, rich, {}, content),
      picks = kit.pool.slice(0, kit.slots);
    expect(validLoadout(kit, picks)).toBe(true);
    expect(fieldedTowers(kit, picks, content)).toHaveLength(kit.slots + 1);
  });

  it("a special op lends its whole list, owned or not", () => {
    const special = campaign.find((m) => m.availableTowers)!,
      kit = kitOf(special, EMPTY_ARSENAL, {}, content);
    expect(kit.special).toBe(true);
    expect([...kit.pool, ...kit.issued].sort()).toEqual(availableTowers(special, content).sort());
  });

  it("invalid picks are rejected and dropped", () => {
    const kit = kitOf(campaign[campaign.length - 1], rich, {}, content);
    expect(validLoadout(kit, kit.pool.slice(0, kit.slots + 1))).toBe(false);
    expect(validLoadout(kit, [kit.pool[0], kit.pool[0]])).toBe(false);
    expect(fieldedTowers(kit, ["nope" as TowerId, ...kit.pool], content).length).toBe(kit.slots + kit.issued.length);
  });
});

describe("auto-fill", () => {
  it("keeps valid picks, answers an uncovered need and never exceeds the slots", () => {
    const m = campaign.find((x) => !x.availableTowers && missionNeeds(x, content).includes("air"))!,
      kit = kitOf(m, rich, {}, content),
      ground = kit.pool.filter((id) => !answers([id], content).air.length),
      keep = ground.slice(0, kit.slots - 1),
      picks = autoLoadout(kit, m, rich, content, [...keep, "nope" as TowerId]);
    expect(picks.length).toBe(kit.slots);
    expect(picks.slice(0, keep.length)).toEqual(keep);
    expect(answers(picks, content).air.length).toBeGreaterThan(0);
    expect(validLoadout(kit, picks)).toBe(true);
  });

  it("fills by XP", () => {
    const m = campaign.find((x) => !x.availableTowers)!,
      kit = kitOf(m, rich, {}, content),
      star = kit.pool.at(-1)!;
    expect(autoLoadout(kit, m, { ...rich, xp: { [star]: 999 } }, content)).toContain(star);
  });
});
