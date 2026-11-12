import { describe, expect, it } from "vitest";
import { gearBadge, markPips, rankChevrons } from "./gear-badge";

describe("gear badges", () => {
  it("are empty at zero", () => {
    expect(rankChevrons(0)).toBe("");
    expect(gearBadge({ rank: 0, mark: 0 })).toBe("");
  });
  it("carry labels", () => {
    expect(rankChevrons(3)).toContain('aria-label="Rank 3"');
    expect(rankChevrons(3).match(/<i>/g)).toHaveLength(3);
    expect(markPips(3)).toContain('aria-label="Gear Mk III"');
    expect(markPips(2, true).match(/<i/g)).toHaveLength(5);
    expect(markPips(2, true)).toContain("ready");
    expect(gearBadge({ rank: 2, mark: 3 })).toMatch(/Rank 2.*Mk III/);
  });
});
