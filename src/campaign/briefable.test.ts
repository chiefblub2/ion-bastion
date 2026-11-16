import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { MISSIONS } from "../content/missions";
import { briefable } from "./briefable";

describe("briefable", () => {
  const solo = { solo: true, unlockAll: false },
    campaign = MISSIONS.find((m) => !m.circle)!,
    ring = MISSIONS.find((m) => m.circle)!;
  it("briefs a solo campaign mission with the Arsenal in force", () => {
    expect(briefable(campaign.id, MISSIONS, solo)).toBe(campaign);
  });
  it("starts everything else directly", () => {
    expect(briefable(ring.id, MISSIONS, solo)).toBeUndefined();
    expect(briefable(DEFAULT_CONTENT.training!.id, MISSIONS, solo)).toBeUndefined();
    expect(briefable(`playtest:${campaign.id}`, MISSIONS, solo)).toBeUndefined();
    expect(briefable(`run:1:0`, MISSIONS, solo)).toBeUndefined();
    expect(briefable(campaign.id, MISSIONS, { solo: false, unlockAll: false })).toBeUndefined();
    expect(briefable(campaign.id, MISSIONS, { solo: true, unlockAll: true })).toBeUndefined();
  });
});
