import { describe, expect, it } from "vitest";
import type { Tower } from "../core/types";
import { upgradeControl } from "./upgrade-tooltip";
import { towerDetails } from "./tower-details";

const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
const pulse = (upgrades: string[]): Tower => ({ id: 1, type: "pulse", x: 0, y: 0, upgrades, cooldown: 0, spent: 80, angle: 0, kills: 0, owner: 0 });
const offered = (html: string) => [...html.matchAll(/data-upgrade="([^"]+)"/g)].map((m) => m[1]);

describe("specialization panel", () => {
  it("offers only the next level below level 5", () => {
    expect(offered(upgradeControl(pulse(["level-2", "level-3"])))).toEqual(["level-4"]);
  });
  it("shows three path cards at level 5 with role, price and the lock hint", () => {
    const html = upgradeControl(pulse(LEVELS));
    expect(offered(html)).toEqual(["sharpshooter-1", "overclock-1", "ricochet-1"]);
    expect(html).toContain("Sharpshooter I");
    expect(html).toContain("Boss · Level 6");
    expect(html).toContain("◇ 200");
    expect(html).toContain("Locks the other two paths");
    expect(html).toContain("--path-color:#66b6ff");
    expect(towerDetails("pulse", pulse(LEVELS), [])).toContain("LEVEL 5 / 8");
  });
  it("shows only the next tier of the chosen path with final values", () => {
    const html = upgradeControl(pulse([...LEVELS, "ricochet-1"]));
    expect(offered(html)).toEqual(["ricochet-2"]);
    expect(html).toMatch(/Every nth shot<\/span><span class="upgrade-before">4<\/span>.*<strong>3<\/strong>/);
    expect(html).toContain("Ricochet II · Level 6 → 7");
    expect(towerDetails("pulse", pulse([...LEVELS, "ricochet-1"]), [])).toContain("LEVEL 6 / 8 · RICOCHET");
  });
  it("ends with Max level and the path name at level 8", () => {
    const done = pulse([...LEVELS, "overclock-1", "overclock-2", "overclock-3"]);
    expect(upgradeControl(done)).toContain("Max level");
    expect(towerDetails("pulse", done, [])).toContain("LEVEL 8 / 8 · OVERCLOCK");
  });
});
