import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import type { MissionDefinition } from "../core/types";
import { nextMission } from "./next-mission";
import type { CampaignRecord } from "./record";

const campaign = MISSIONS.filter((m) => !m.circle),
  circuit = MISSIONS.filter((m) => m.circle),
  won = (...ms: MissionDefinition[]): CampaignRecord => Object.fromEntries(ms.map((m) => [m.id, 2]));

describe("next mission", () => {
  it("moves on after a won mission and wraps round to a skipped one", () => {
    expect(nextMission(MISSIONS, won(campaign[0]), { after: campaign[0] })).toBe(campaign[1]);
    const record = won(campaign[0], campaign[2]);
    expect(nextMission(MISSIONS, record, { after: campaign[2] })).toBe(campaign[3]);
    const allBut1 = won(...campaign.filter((m) => m !== campaign[1]));
    expect(nextMission(MISSIONS, allBut1, { after: campaign.at(-1)! })).toBe(campaign[1]);
  });

  it("skips locked missions and never crosses between campaign and Circuit", () => {
    const locks = new Map([[campaign[1].id, { kind: "mission" as const, after: campaign[0] }]]);
    expect(nextMission(MISSIONS, won(campaign[0]), { after: campaign[0], locks })).toBe(campaign[2]);
    const all = won(...campaign);
    expect(nextMission(MISSIONS, all, { after: campaign.at(-1)! })).toBeUndefined();
    expect(nextMission(MISSIONS, all, { circle: false })).toBeUndefined();
    expect(nextMission(MISSIONS, all, { circle: true })).toBe(circuit[0]);
    expect(nextMission(MISSIONS, won(circuit[0]), { after: circuit[0] })).toBe(circuit[1]);
  });
});
