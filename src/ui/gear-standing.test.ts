import { describe, expect, it } from "vitest";
import { standingOf, type Arsenal } from "../campaign/arsenal";
import { DEFAULT_CONTENT } from "../content";
import { SIGNATURES } from "../content/arsenal";
import { towerAt } from "../core/test-helpers";
import type { Tower } from "../core/types";
import { gearLabel, standingIn } from "./gear-standing";
import { signatureText } from "./gear-text";
import { towerCardHtml } from "./tower-card";
import { towerDetails } from "./tower-details";

const arsenal = { salvage: 0, researched: [], xp: { pulse: 1e6 }, gear: { pulse: 5, nova: 2 }, loadout: [], bounty: null } as Arsenal;
const pulse = (): Tower => ({ ...towerAt(1, "pulse", 0, 0, []), spent: 80 });

describe("campaign gear in play", () => {
  it("reads the standing only while the game carries an arsenal", () => {
    expect(standingIn(arsenal, true, "pulse")).toEqual(standingOf(arsenal, "pulse"));
    expect(standingIn(arsenal, false, "pulse")).toBeUndefined();
    expect(standingIn(null, true, "pulse")).toBeUndefined();
    expect(standingIn(arsenal, true, "frost")).toBeUndefined();
    expect(gearLabel({ rank: 3, mark: 2 })).toBe("Rank 3, Gear Mk II");
  });
  it("puts a badge on the card only for a geared or ranked tower", () => {
    const opts = { credits: 100, slim: false };
    expect(towerCardHtml(pulse(), [], opts)).not.toContain("gear-badge");
    expect(towerCardHtml(pulse(), [], { ...opts, gear: { rank: 0, mark: 0 } })).not.toContain("gear-badge");
    expect(towerCardHtml(pulse(), [], { ...opts, gear: { rank: 2, mark: 3 } })).toMatch(/<\/strong><span class="gear-badge">/);
  });
  it("spells out rank, marks and the signature in the sidebar, and nothing for an ungeared tower", () => {
    const base = DEFAULT_CONTENT,
      sig = signatureText("pulse", base)!,
      html = towerDetails("pulse", pulse(), [], base, { standing: { rank: 3, mark: 5 }, base });
    expect(html).toContain("Rank 3: build cost −9%");
    expect(html).toContain(SIGNATURES.pulse!.name);
    expect(html).toContain(sig.text.split(" (")[0]);
    expect(html.indexOf("gear-block")).toBeLessThan(html.indexOf("path-ladder"));
    expect(towerDetails("pulse", pulse(), [], base, { standing: undefined, base })).not.toContain("gear-block");
    expect(towerDetails("pulse", pulse(), [], base)).not.toContain("gear-block");
  });
});
