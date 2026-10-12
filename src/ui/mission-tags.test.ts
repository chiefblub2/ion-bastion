import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { missionTags } from "./mission-tags";
const { missions } = DEFAULT_CONTENT;
describe("mission tags", () => {
  it("mark rings, restricted towers and air threats from the content", () => {
    const ring = missions.find((m) => m.circle)!;
    expect(missionTags(ring, DEFAULT_CONTENT)).toContain("Circuit");
    const restricted = missions.find((m) => m.availableTowers);
    if (restricted) expect(missionTags(restricted, DEFAULT_CONTENT)).toContain("Restricted towers");
    expect(missions.some((m) => missionTags(m, DEFAULT_CONTENT).includes("Air threats"))).toBe(true);
    expect(missionTags(missions[0], DEFAULT_CONTENT)).not.toContain("Circuit");
  });
});
