import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "../core/game";
import { MISSIONS } from "../content/missions";
import { DEFAULT_CONTENT } from "../content/index";
import { VETERANCY_XP } from "../content/arsenal";
import { dailyDate } from "../run/daily";
import { ARSENAL_VERSION, arsenalTowers, bountyToday, loadArsenal, parseArsenal, saveArsenal, updateArsenal } from "./arsenal-store";
import { EMPTY_ARSENAL } from "../campaign/arsenal";
import { backPayOf } from "../campaign/migrate";
import { MissionTally } from "../campaign/tally";
import { end } from "./campaign-session";

/** An in-memory Storage, stubbed per test and restored after it. */
function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("arsenal store", () => {
  it("parses defensively", () => {
    expect(parseArsenal("{bad")).toEqual(EMPTY_ARSENAL);
    expect(parseArsenal(JSON.stringify({ v: ARSENAL_VERSION, salvage: 12.7, researched: ["lance", "nope", "lance"], xp: { pulse: 5, x: 3 }, gear: {}, loadout: ["pulse", "x"], bounty: { day: 1 } })))
      .toEqual({ salvage: 12, researched: ["lance"], xp: { pulse: 5 }, gear: {}, loadout: ["pulse"], bounty: null });
  });

  it("narrows campaign missions only, and restart keeps it", () => {
    const first = MISSIONS[0],
      game = new Game(first),
      towers = arsenalTowers(first.id, EMPTY_ARSENAL)!;
    game.command({ type: "mission", id: first.id, towers });
    expect(game.availableTowers()).toEqual(towers);
    game.command({ type: "restart" });
    expect(game.availableTowers()).toEqual(towers);
    game.command({ type: "mission", id: first.id });
    expect(game.availableTowers().length).toBeGreaterThan(towers.length);
    expect(arsenalTowers(MISSIONS.find((m) => m.circle)!.id, EMPTY_ARSENAL)).toBeUndefined();
  });
});

describe("stored arsenal", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memory());
    vi.stubGlobal("sessionStorage", memory());
  });
  afterEach(() => vi.unstubAllGlobals());
  const sectors = DEFAULT_CONTENT.sectors!,
    finale = sectors[0].missions.at(-1)!;

  it("migrates v1 once, keeping every field and adding the back pay", () => {
    const record = { [MISSIONS[0].id]: 3, [finale.id]: 2 } as const,
      v1 = { salvage: 40, researched: ["lance"], xp: { pulse: VETERANCY_XP[1], frost: 5 }, gear: { pulse: 1 } };
    localStorage.setItem("ion-bastion:campaign", JSON.stringify({ v: 1, stars: record }));
    localStorage.setItem("ion-bastion:arsenal", JSON.stringify({ v: 1, ...v1 }));
    const pay = backPayOf(v1, record, sectors),
      a = loadArsenal();
    expect(pay).toBeGreaterThan(0);
    expect(a).toEqual({ ...v1, salvage: v1.salvage + pay, loadout: [], bounty: null });
    expect(JSON.parse(localStorage.getItem("ion-bastion:arsenal")!).v).toBe(ARSENAL_VERSION);
    // Saved as v2 at once: loading again pays nothing more.
    expect(loadArsenal()).toEqual(a);
  });

  it("never overwrites data from a newer build", () => {
    const newer = JSON.stringify({ v: ARSENAL_VERSION + 1, salvage: 999 });
    localStorage.setItem("ion-bastion:arsenal", newer);
    expect(loadArsenal()).toEqual(EMPTY_ARSENAL);
    expect(saveArsenal({ ...EMPTY_ARSENAL, salvage: 5 })).toBe(false);
    expect(updateArsenal((a) => ({ ...a, salvage: 5 })).salvage).toBe(0);
    expect(localStorage.getItem("ion-bastion:arsenal")).toBe(newer);
  });

  it("keeps the day's bounty pick and pays it once", () => {
    const now = new Date(),
      game = new Game(MISSIONS[0]);
    expect(bountyToday(now)?.id).toBe(MISSIONS[0].id); // the only open mission on a fresh record
    const first = end(game, true, new MissionTally(), 0),
      again = end(game, true, new MissionTally(), 0);
    expect(first.pay.lines.some((l) => l.kind === "bounty")).toBe(true);
    expect(again.pay.lines.some((l) => l.kind === "bounty")).toBe(false);
    expect(bountyToday(now)).toEqual({ day: dailyDate(now), id: MISSIONS[0].id, paid: true });
  });

  it("a loss pays the waves before the one lost on, never the record", () => {
    const game = new Game(MISSIONS[0]);
    game.state.wave = 4;
    const d = end(game, false, new MissionTally(), 0);
    expect(d.waves.cleared).toBe(3);
    expect(d.pay.lines.map((l) => [l.kind, l.count])).toEqual([["waves", 3]]);
    expect(d.next.kind).toBe("none");
    expect(d.tip).toBeDefined();
    expect(localStorage.getItem("ion-bastion:campaign")).toBeNull();
    expect(loadArsenal().salvage).toBe(d.pay.total);
  });
});
