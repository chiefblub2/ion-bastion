import { describe, expect, it } from "vitest";
import { MISSIONS, nextMissionOf } from "../content/missions";
import { asPlaytest, isPlaytest } from "./playtest-id";

describe("playtest ids and the next mission", () => {
  it("marks only playtest copies", () => {
    expect(isPlaytest(MISSIONS[0])).toBe(false);
    expect(isPlaytest(asPlaytest(MISSIONS[0]))).toBe(true);
  });
  it("has no next mission for a playtest or an unknown id", () => {
    expect(nextMissionOf(MISSIONS, asPlaytest(MISSIONS[0]).id)).toBeUndefined();
    expect(nextMissionOf(MISSIONS, "gone")).toBeUndefined();
  });
  it("has none after the last mission, else the following one", () => {
    expect(nextMissionOf(MISSIONS, MISSIONS[MISSIONS.length - 1].id)).toBeUndefined();
    expect(nextMissionOf(MISSIONS, MISSIONS[0].id)).toBe(MISSIONS[1]);
  });
});
