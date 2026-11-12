import { describe, expect, it } from "vitest";
import { GEAR_MARKS, MAX_MARK, SIGNATURES } from "../content/arsenal";
import { DEFAULT_CONTENT } from "../content";
import { gearClassOf, markDelta } from "../campaign/gear";
import type { TowerId } from "../core/types";
import { gearLines, markText, signatureText } from "./gear-text";

const T = DEFAULT_CONTENT.towers;
const ids = Object.keys(T) as TowerId[];
const pctOf = (f: number) => `${Math.round((f - 1) * 100)}%`;

describe("markText", () => {
  it("states each table entry's numbers", () => {
    for (const cls of Object.keys(GEAR_MARKS) as (keyof typeof GEAR_MARKS)[]) {
      const t = Object.values(T).find((d) => gearClassOf(d) === cls)!;
      for (const e of GEAR_MARKS[cls]) {
        const text = markText(e, t);
        if ("stat" in e) expect(text).toContain(`+${pctOf(e.total)}`);
        else if ("early" in e) expect(text).toContain(`${Math.round((1 - e.early) * 100)}%`);
        else if ("paths" in e) expect(text).toContain(`${Math.round((1 - e.paths) * 100)}%`);
        else expect(text).toContain(`${Math.round((1 - e.build) * 100)}%`);
      }
    }
  });
  it("words Aura's early levels as track tiers", () => {
    expect(markText({ early: 0.8 }, T.aura)).toMatch(/tier/i);
    expect(markText({ early: 0.8 }, T.pulse)).toMatch(/Levels 2–3/);
  });
});

describe("signatureText", () => {
  const first = (test: (s: NonNullable<(typeof SIGNATURES)[TowerId]>) => boolean) => ids.find((id) => SIGNATURES[id] && test(SIGNATURES[id]!))!;
  it("reads each form from its spec", () => {
    const slow = first((s) => "hit" in s && s.hit.kind === "slow"),
      stun = first((s) => "hit" in s && s.hit.kind === "stun"),
      expose = first((s) => "hit" in s && s.hit.kind === "vulnerable"),
      bounty = first((s) => "bounty" in s);
    const hit = (id: TowerId) => (SIGNATURES[id] as { hit: { duration: number } }).hit;
    expect(signatureText(slow, DEFAULT_CONTENT)!.text).toContain(`${hit(slow).duration} s`);
    expect(signatureText(stun, DEFAULT_CONTENT)!.text).toContain("stunned");
    expect(signatureText(expose, DEFAULT_CONTENT)!.text).toContain("more damage");
    expect(signatureText(bounty, DEFAULT_CONTENT)!.text).toContain(`+${(SIGNATURES[bounty] as { bounty: number }).bounty}`);
  });
  it("shows before and after of stat and param forms", () => {
    for (const id of ids.filter((i) => SIGNATURES[i] && !("hit" in SIGNATURES[i]!) && !("bounty" in SIGNATURES[i]!))) {
      const c = markDelta(DEFAULT_CONTENT, id, MAX_MARK)[0];
      const text = signatureText(id, DEFAULT_CONTENT)!.text;
      if (c.label !== "Range") expect(text).toContain(c.label);
      expect(text).toContain(`${c.before} → ${c.after}`);
    }
  });
  it("exists for every tower", () => {
    for (const id of ids) expect(signatureText(id, DEFAULT_CONTENT)?.text, id).toBeTruthy();
  });
});

describe("gearLines", () => {
  it("grows with the mark and ends with the signature", () => {
    const lens = [0, 1, 2, 3, 4, 5].map((m) => gearLines("pulse", m, DEFAULT_CONTENT).length);
    expect(lens[0]).toBe(0);
    expect(lens[1]).toBeGreaterThan(0);
    expect(lens[4]).toBeGreaterThanOrEqual(lens[3]);
    expect(lens[5]).toBe(lens[4] + 1);
    expect(gearLines("pulse", 5, DEFAULT_CONTENT).at(-1)).toContain(SIGNATURES.pulse!.name);
  });
});
