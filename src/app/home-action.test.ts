import { describe, expect, it } from "vitest";
import { asPlaytest } from "../editor/playtest-id";
import { MISSIONS } from "../content/missions";
import { homeAction, type HomeSession } from "./home-action";
import { campaignLocks } from "./campaign-unlock";
import { SECTORS } from "../content/missions";
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
  it("retries an unwon remembered mission from wave 1 after a reload", () => {
    const a = homeAction(MISSIONS, MISSIONS[3].id, fresh);
    expect(a.kind).toBe("restart");
    expect(a.title).toBe("Retry Mission");
    expect(a.mission).toBe(MISSIONS[3]);
    expect(a.subtitle).toContain("From wave 1");
  });
  it("continues with the next unwon mission after a won one", () => {
    const record = { [MISSIONS[3].id]: 2, [MISSIONS[4].id]: 3 } as const;
    const a = homeAction(MISSIONS, MISSIONS[3].id, fresh, record);
    expect(a.kind).toBe("continue");
    expect(a.mission).toBe(MISSIONS[5]);
    expect(a.subtitle).toBe(`Mission 06 · ${MISSIONS[5].name}`);
  });
  it("never continues to a locked mission and goes back to a skipped one instead", () => {
    const list = SECTORS[0].missions,
      record = { [list[0].id]: 3, [list[1].id]: 2, [list[4].id]: 1 } as const,
      a = homeAction(MISSIONS, list[4].id, fresh, record, campaignLocks(SECTORS, record));
    expect(a.kind).toBe("continue");
    expect(a.mission).toBe(list[2]);
  });
  it("continues within the remembered mission's mode", () => {
    const ring = MISSIONS.filter((m) => m.circle),
      a = homeAction(MISSIONS, ring[0].id, fresh, { [ring[0].id]: 1 });
    expect(a.mission).toBe(ring[1]);
    expect(a.title).toBe("Continue Circuit");
  });
  it("continues the campaign when the last mission is forgotten but wins are recorded", () => {
    const a = homeAction(MISSIONS, undefined, fresh, { [MISSIONS[0].id]: 3 });
    expect(a.kind).toBe("continue");
    expect(a.mission).toBe(MISSIONS[1]);
  });
  it("plays a won mission again once its whole mode is won", () => {
    const campaign = MISSIONS.filter((m) => !m.circle),
      record = Object.fromEntries(campaign.map((m) => [m.id, 3 as const])),
      a = homeAction(MISSIONS, campaign[2].id, fresh, record);
    expect(a.kind).toBe("restart");
    expect(a.title).toBe("Play Again");
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
  it("offers a restart with the playtest mission for a finished playtest", () => {
    const playtest = asPlaytest(MISSIONS[0]);
    for (const status of ["won", "lost"] as const) {
      const a = homeAction(MISSIONS, undefined, { ...fresh, mission: playtest, wave: 3, status, inProgress: true });
      expect(a.kind).toBe("restart");
      expect(a.mission).toBe(playtest);
    }
  });
  it("always resumes in multiplayer", () => {
    expect(homeAction(MISSIONS, undefined, { ...fresh, status: "lost", inProgress: true, multiplayer: true }).kind).toBe("resume");
  });
});
