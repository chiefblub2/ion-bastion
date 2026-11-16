import { describe, expect, it } from "vitest";
import { ledgerLabel, outcomeTitle, ratingText, rankUpText, wavesText } from "./debrief-text";

describe("debrief wording", () => {
  it("labels every ledger line and marks a loss as half pay", () => {
    expect(ledgerLabel({ kind: "waves", amount: 40, count: 12 }, true)).toBe("12 waves cleared");
    expect(ledgerLabel({ kind: "waves", amount: 20, count: 12 }, false)).toContain("half pay");
    expect(ledgerLabel({ kind: "stars", amount: 8, count: 1 }, true)).toBe("1 new star");
    expect(ledgerLabel({ kind: "bounty", amount: 10 }, true)).toBe("Daily bounty ×2");
  });
  it("states the star thresholds with the value reached", () => {
    const rating = { kind: "energy" as const, three: 0.9, two: 0.5, value: 0.9, left: 18, max: 20 };
    expect(ratingText({ rating })).toBe("Reactor 18/20 · ★★★ at 90%, ★★ at 50%");
    expect(ratingText({ rating: { kind: "ring", three: 0.5, two: 0.8, value: 0.4 } })).toContain("peaked at 40%");
  });
  it("names the outcome and the waves", () => {
    const rating = { kind: "energy" as const, three: 0.9, two: 0.5, value: 1 };
    expect(outcomeTitle({ won: true, rating })).toBe("The line holds.");
    expect(outcomeTitle({ won: false, rating })).toBe("Reactor lost.");
    expect(wavesText({ waves: { cleared: 1, total: 1 }, kills: 1 })).toBe("1 of 1 wave cleared · 1 kill");
  });
  it("calls out a rank-up with the marks it opens, and nothing without one", () => {
    expect(rankUpText({ rankBefore: 0, rankAfter: 0, bonus: 0 })).toBeUndefined();
    expect(rankUpText({ rankBefore: 1, rankAfter: 2, bonus: 25 })?.long).toBe("Rank 2 · +25 Salvage · Mk II can be forged");
    expect(rankUpText({ rankBefore: 0, rankAfter: 2, bonus: 40 })?.long).toContain("Mk I–II");
  });
});
