import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { Match } from "./match";
import { READY_COUNTDOWN, sendCost, type ModeId } from "./modes";
import { makeEnemy } from "./test-helpers";
import { applyDamage } from "../systems/damage";
import { MISSIONS } from "../content/missions";
import type { MissionDefinition } from "./types";
function match(mode: ModeId, players = 2, mission: MissionDefinition = MISSIONS[0]) {
  const m = new Match(mode, players, 0, new Game());
  expect(m.command({ type: "mission", id: mission.id, player: 0 }).ok).toBe(true);
  return m;
}
const statuses = (m: Match) => m.fields.map((f) => f.state.status);
/** Ticks until no field fights a wave any more, or the match ends. */
function finishWaves(m: Match) {
  let guard = 0;
  do m.tick();
  while (!m.result && m.fields.some((f, i) => m.isAlive(i) && f.state.status === "wave") && guard++ < 40000);
  expect(guard).toBeLessThan(40000);
}
function readyAll(m: Match) {
  m.fields.forEach((_, i) => m.isAlive(i) && m.command({ type: "ready", player: i }));
  m.tick();
}
describe("versus match", () => {
  it("gives every player an own field with the full starting credits", () => {
    const m = match("race", 3);
    expect(m.fields).toHaveLength(3);
    expect(m.fields.map((f) => f.state.wallets)).toEqual([0, 1, 2].map(() => [MISSIONS[0].startingCredits]));
    expect(m.command({ type: "build", tower: "pulse", x: 4, y: 4, player: 2 }).ok).toBe(true);
    expect(m.fields.map((f) => f.state.towers.length)).toEqual([0, 0, 1]);
    expect(m.fields[2].state.towers[0].owner).toBe(0);
  });
  it("starts a wave on all fields at once when everyone is ready", () => {
    const m = match("race");
    expect(m.command({ type: "start", player: 0 }).code).toBe("ready-set");
    m.tick();
    expect(statuses(m)).toEqual(["ready", "ready"]);
    expect(m.command({ type: "ready", player: 1 }).ok).toBe(true);
    m.tick();
    expect(statuses(m)).toEqual(["wave", "wave"]);
    expect(m.fields.map((f) => f.state.wave)).toEqual([1, 1]);
    expect(m.command({ type: "ready", player: 0 }).code).toBe("wave-running");
  });
  it("starts the next wave on its own when the countdown runs out", () => {
    const m = match("race");
    for (let i = 0; i < READY_COUNTDOWN - 1; i++) m.tick();
    expect(statuses(m)).toEqual(["ready", "ready"]);
    m.tick();
    expect(statuses(m)).toEqual(["wave", "wave"]);
    expect(m.countdown).toBe(READY_COUNTDOWN);
  });
  it("has no pause and leaves mission changes to the host", () => {
    const m = match("race");
    readyAll(m);
    expect(m.command({ type: "pause", player: 0 }).code).toBe("pause-versus");
    expect(m.command({ type: "restart", player: 1 }).code).toBe("host-only");
    expect(m.command({ type: "mission", id: MISSIONS[1].id, player: 1 }).code).toBe("host-only");
    expect(m.command({ type: "mission", id: MISSIONS[1].id, player: 0 }).ok).toBe(true);
    expect(m.fields.map((f) => f.mission.id)).toEqual([MISSIONS[1].id, MISSIONS[1].id]);
    expect(statuses(m)).toEqual(["ready", "ready"]);
  });
  it("crowns the last reactor standing", () => {
    const m = match("race", 3);
    m.fields[0].state.lives = 10000;
    m.fields[2].state.lives = 5000;
    while (!m.result) {
      readyAll(m);
      finishWaves(m);
    }
    expect(m.isAlive(1)).toBe(false);
    expect(m.result.winner).toBe(0);
    expect(m.result.ranking).toEqual([0, 2, 1]);
    // A finished match ignores further input.
    expect(m.command({ type: "ready", player: 0 }).code).toBe("mission-over");
  });
  it("ranks survivors by reactor energy and declares a draw on a tie", () => {
    const m = match("race");
    m.fields.forEach((f) => (f.state.lives = 10000));
    while (!m.result) {
      readyAll(m);
      finishWaves(m);
    }
    expect(statuses(m)).toEqual(["won", "won"]);
    expect(m.result.winner).toBeNull();
    m.command({ type: "restart", player: 0 });
    expect(m.result).toBeNull();
    m.fields[0].state.lives = 10000;
    m.fields[1].state.lives = 10001;
    while (!m.result) {
      readyAll(m);
      finishWaves(m);
    }
    expect(m.result.ranking).toEqual([1, 0]);
  });
  it("keeps the hash equal for equal sessions and different otherwise", () => {
    const a = match("siege"),
      b = match("siege");
    readyAll(a);
    readyAll(b);
    for (let i = 0; i < 100; i++) [a, b].forEach((m) => m.tick());
    expect(a.hash()).toBe(b.hash());
    a.command({ type: "build", tower: "pulse", x: 4, y: 4, player: 1 });
    expect(a.hash()).not.toBe(b.hash());
  });
});
describe("siege sends", () => {
  const firstEnemy = MISSIONS[0].waves[0].groups[0].type;
  it("is only available in siege", () => {
    expect(match("race").command({ type: "send", enemy: firstEnemy, player: 0 }).code).toBe("send-unavailable");
  });
  it("buffers sends between waves and adds them to the target's next wave", () => {
    const m = match("siege"),
      cost = sendCost(m.fields[0].content.enemies[firstEnemy]),
      credits = m.fields[0].state.wallets[0];
    const r = m.command({ type: "send", enemy: firstEnemy, player: 0 });
    expect(r.code).toBe("enemy-sent");
    expect(r.params?.target).toBe(2);
    expect(m.fields[0].state.wallets[0]).toBe(credits - cost);
    expect(m.pending[1]).toHaveLength(1);
    const before = m.fields.map((f) => f.state.wallets[0]);
    readyAll(m);
    expect(m.pending[1]).toHaveLength(0);
    expect(m.fields[1].state.queue.length).toBe(m.fields[0].state.queue.length + 1);
    expect(m.fields[1].state.queue.filter((s) => s.sentBy === 0)).toHaveLength(1);
    expect(m.fields.map((f) => f.state.wallets[0])).toEqual(before);
  });
  it("queues sends into a running wave behind the current wave time", () => {
    const m = match("siege");
    readyAll(m);
    for (let i = 0; i < 60; i++) m.tick();
    m.command({ type: "send", enemy: firstEnemy, player: 1 });
    m.command({ type: "send", enemy: firstEnemy, player: 1 });
    const sent = m.fields[0].state.queue.filter((s) => s.sentBy === 1),
      now = m.fields[0].state.waveTime;
    expect(sent).toHaveLength(2);
    expect(sent[0].at).toBeGreaterThan(now);
    expect(sent[1].at).toBeGreaterThan(sent[0].at);
  });
  it("rejects unaffordable and locked enemies", () => {
    const m = match("siege");
    m.fields[0].state.wallets[0] = 0;
    expect(m.command({ type: "send", enemy: firstEnemy, player: 0 }).code).toBe("credits-missing");
    const mission = MISSIONS.find((mi) => {
      const first = new Set(mi.waves[0].groups.map((g) => g.type));
      return mi.waves.some((w) => w.groups.some((g) => !first.has(g.type)));
    })!;
    const later = match("siege", 2, mission),
      locked = later.sendOptions(0).find((o) => !o.unlocked)!;
    expect(locked).toBeDefined();
    expect(later.command({ type: "send", enemy: locked.enemy, player: 0 }).code).toBe("send-locked");
  });
  it("targets the next opponent still standing", () => {
    const m = match("siege", 3);
    expect([0, 1, 2].map((p) => m.target(p))).toEqual([1, 2, 0]);
    m.eliminatedAt[1] = 1;
    expect(m.target(0)).toBe(2);
    expect(m.command({ type: "send", enemy: firstEnemy, player: 1 }).code).toBe("mission-over");
  });
  it("pays no kill reward for sent enemies", () => {
    const g = new Game();
    const sent = { ...makeEnemy(900, firstEnemy, 1, 1), hp: 1, sentBy: 1 },
      normal = { ...makeEnemy(901, firstEnemy, 1, 1), hp: 1 };
    g.state.enemies.push(sent, normal);
    const credits = g.state.wallets[0];
    applyDamage(g, { tower: 0, type: "pulse" }, sent, 10);
    expect(g.state.wallets[0]).toBe(credits);
    applyDamage(g, { tower: 0, type: "pulse" }, normal, 10);
    expect(g.state.wallets[0]).toBe(credits + g.content.enemies[firstEnemy].reward);
    expect(g.state.kills).toBe(2);
  });
});
