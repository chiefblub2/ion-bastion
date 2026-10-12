import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { homeAction, type HomeSession } from "./home-action";
const fresh: HomeSession = { mission: MISSIONS[0], wave: 0, status: "ready", inProgress: false, multiplayer: false };
describe("home action", () => {
  it("starts a first-time visitor on the mission selector", () => {
    const a = homeAction(MISSIONS, undefined, fresh);
    expect(a.kind).toBe("start");
    expect(a.title).toBe("Start Playing");
  });
  it("ignores an invalid remembered mission", () => {
    expect(homeAction(MISSIONS, "gone", fresh).kind).toBe("start");
  });
  it("restarts a remembered mission from wave 1 after a reload", () => {
    const a = homeAction(MISSIONS, MISSIONS[3].id, fresh);
    expect(a.kind).toBe("restart");
    expect(a.mission).toBe(MISSIONS[3]);
    expect(a.subtitle).toContain("Starts from wave 1");
  });
  it("resumes a running or prepared game, paused or not", () => {
    const wave = homeAction(MISSIONS, MISSIONS[0].id, { ...fresh, mission: MISSIONS[2], wave: 6, status: "wave", inProgress: true });
    expect(wave.kind).toBe("resume");
    expect(wave.subtitle).toBe(`${MISSIONS[2].name} · Wave 06`);
    expect(homeAction(MISSIONS, undefined, { ...fresh, inProgress: true }).subtitle).toContain("Wave 01");
  });
  it("offers a restart, not a resume, for a finished game", () => {
    for (const status of ["won", "lost"] as const) {
      const a = homeAction(MISSIONS, undefined, { ...fresh, mission: MISSIONS[1], wave: 4, status, inProgress: true });
      expect(a.kind).toBe("restart");
      expect(a.mission).toBe(MISSIONS[1]);
    }
  });
  it("always resumes in multiplayer", () => {
    expect(homeAction(MISSIONS, undefined, { ...fresh, status: "lost", inProgress: true, multiplayer: true }).kind).toBe("resume");
  });
});
