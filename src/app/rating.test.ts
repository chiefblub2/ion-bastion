import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { Game } from "../core/game";
import { missionStars, PeakTracker, starText } from "./rating";
import { mergeRecord, parseRecord, storedRecord } from "./progress";

const reactor = MISSIONS.find((m) => !m.circle)!,
  ring = MISSIONS.find((m) => m.circle)!,
  lives = (share: number) => ({ lives: Math.round(reactor.reactorEnergy * share) });

describe("missionStars", () => {
  it("rates reactor missions by the energy left", () => {
    expect(missionStars(reactor, lives(1))).toBe(3);
    expect(missionStars(reactor, lives(0.6))).toBe(2);
    expect(missionStars(reactor, { lives: 1 })).toBe(1);
    expect(missionStars(reactor, lives(2))).toBe(3);
  });
  it("rates circle missions by the fullest ring", () => {
    expect(missionStars(ring, { lives: 0 }, 0.4)).toBe(3);
    expect(missionStars(ring, { lives: 0 }, 0.7)).toBe(2);
    expect(missionStars(ring, { lives: 0 }, 0.95)).toBe(1);
    expect(missionStars(ring, { lives: 0 })).toBe(1);
  });
});

describe("PeakTracker", () => {
  it("resets when the state is swapped", () => {
    const game = new Game(ring),
      tracker = new PeakTracker();
    game.state.status = "wave";
    game.state.enemies.length = 0;
    tracker.peak = 0.9;
    tracker.observe(ring, game.state);
    expect(tracker.peak).toBe(0);
  });
});

describe("campaign record", () => {
  it("keeps the best stars", () => {
    const one = mergeRecord({}, "a", 2);
    expect(one).toEqual({ a: 2 });
    expect(mergeRecord(one, "a", 1)).toBe(one);
    expect(mergeRecord(one, "a", 3)).toEqual({ a: 3 });
  });
  it("drops corrupt data", () => {
    expect(parseRecord("{nope")).toEqual({});
    expect(parseRecord("[1]")).toEqual({});
    expect(parseRecord('{"a":3,"b":7,"c":"2"}')).toEqual({ a: 3 });
  });
  it("reads the versioned record and the bare legacy map", () => {
    expect(parseRecord(storedRecord({ a: 2 }))).toEqual({ a: 2 });
    expect(parseRecord('{"a":3}')).toEqual({ a: 3 });
  });
  it("draws the star row", () => expect(starText(2)).toBe("★★☆"));
});
