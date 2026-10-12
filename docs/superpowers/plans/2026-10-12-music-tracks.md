# Music Revision 2: Instrument Tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-note-per-shot with composed instrument tracks per tower family, driven by activity; calmer tempo and drums; synthesized instruments with reverb, stereo and limiting; offline WAV renders for listening.

**Architecture:** Pure `families`, `activity`, `parts`, `stingers`, `wav`; revised `grooves`, `sequencer`, `cues`, `recipes`, `harmony.MUSIC`; Web Audio `instruments` and a revised `engine` (any `BaseAudioContext`); a `Conductor` that owns score, activity, parts and mood and is driven by the game adapter, the sound board and the offline renderer alike.

**Tech Stack:** TypeScript strict ESM, Web Audio API (`OfflineAudioContext` for renders), Vitest 3, playwright-core for the render script.

**Spec:** `docs/superpowers/specs/2026-10-12-music-design.md`, section "Revision 2: instrument tracks" (earlier sections still hold where not replaced).

**Branch:** continue on `music` (its first-pass commits are the base).

## Global Constraints

- Render side only; simulation, state, hash and network untouched.
- No `AudioContext` or DOM at import time; pure modules tested in Node.
- Activity: +0.06 per shot, half-life 1.5 s, cap 1; step ranks need 0.02 / 0.3 / 0.55 / 0.8 (one shot keeps the core steps for about 2.4 s); velocity `0.4 + 0.6 · level`; ≤ 8 notes per family per bar.
- Drums: none below threat 0.25; kick ≥ 0.25; snare ≥ 0.5; hats + bass pulse ≥ 0.75; stomp with heavies.
- Tempo 84–104 BPM for every theme.
- Instruments: polyphony 6 each; reverb send music 0.35, effects 0.12, wet 0.3; compressor −20 dB / 3:1, limiter −3 dB / 20:1.
- `tsc` may be red between Task 3 and Task 8 (shapes change before callers); those tasks gate on Vitest; Task 8 restores `tsc`.
- Files < 500 lines; English; final `npm test` and `npm run build` green.

## Review Focus

1. **Note count independent of fire rate:** 80 shots/s must stay ≤ 8 rapid notes per bar → Conductor test (Task 7).
2. **Part start latency:** the rapid part answers within a beat of the first shot → Conductor test (Task 7).
3. **Offline scheduling:** with `currentTime` fixed at 0 while everything is scheduled, polyphony and mixer must judge by note time, not `currentTime` → engine uses note start (Task 6), verified by the renders (Task 9).
4. **Low threat is drum-free** → Conductor test (Task 7).
5. **Stingers vs. effects:** musical flow cues play instruments and duck where marked; alerts stay ZzFX → Conductor test (Task 7).

---

### Task 1: Families and activity

**Files:** Create `src/audio/families.ts`, `src/audio/activity.ts`; Test `src/audio/families.test.ts`, `src/audio/activity.test.ts`

**Interfaces:**
- Produces: `FAMILIES`, `type Family = "rapid" | "heavy" | "electric" | "control" | "fire" | "traps"`, `familyOf(d: TowerDefinition): Family | null`, `shotsByFamily(events, content): Partial<Record<Family, number>>`; `HALF_LIFE`, `PER_SHOT`, `type Levels = Record<Family, number>`, `silent(): Levels`, `class Activity { levels: Levels; update(shots, now): void }`

- [ ] **Step 1: Write the failing tests**

`src/audio/families.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, TowerDefinition, TowerId } from "../core/types";
import { isSupport } from "../systems/attacks";
import { familyOf, shotsByFamily } from "./families";

const tower = (pick: (d: TowerDefinition) => boolean) => Object.values(DEFAULT_CONTENT.towers).find(pick)!;
const at = { x: 0, y: 0 };
describe("families", () => {
  it("gives every attacking tower a family and support towers none", () => {
    expect(familyOf(tower((d) => d.attack.kind === "direct" && !d.placement))).toBe("rapid");
    expect(familyOf(tower((d) => d.attack.kind === "splash" && !d.placement))).toBe("heavy");
    expect(familyOf(tower((d) => d.placement === "path"))).toBe("traps");
    expect(familyOf(tower((d) => isSupport(d.attack)))).toBeNull();
  });
  it("counts shots per family and ignores other events", () => {
    const direct = tower((d) => d.attack.kind === "direct" && !d.placement).id as TowerId,
      splash = tower((d) => d.attack.kind === "splash" && !d.placement).id as TowerId,
      shot = (t: TowerId): GameEvent => ({ type: "shot", tower: t, from: at, to: at, color: 0 });
    expect(shotsByFamily([shot(direct), shot(direct), shot(splash), { type: "kill", at, color: 0, reward: 1 }], DEFAULT_CONTENT)).toEqual({ rapid: 2, heavy: 1 });
  });
});
```

`src/audio/activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Activity, HALF_LIFE } from "./activity";

describe("Activity", () => {
  it("adds per shot, halves without shots and saturates", () => {
    const a = new Activity();
    a.update({ rapid: 5 }, 0);
    expect(a.levels.rapid).toBeCloseTo(0.3);
    a.update({}, HALF_LIFE);
    expect(a.levels.rapid).toBeCloseTo(0.15);
    a.update({ rapid: 100 }, HALF_LIFE);
    expect(a.levels.rapid).toBe(1);
    expect(a.levels.heavy).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/audio/families.test.ts src/audio/activity.test.ts` — Expected: FAIL, modules missing.

- [ ] **Step 3: Implement `src/audio/families.ts`**

```ts
import type { AttackSpec, ContentPack, GameEvent, TowerDefinition } from "../core/types";
// Tower families: each plays one instrument part of the music; shots raise the family's activity instead of playing notes.

export const FAMILIES = ["rapid", "heavy", "electric", "control", "fire", "traps"] as const;
export type Family = (typeof FAMILIES)[number];
/** Support kinds never fire, so they play no part. */
const BY_KIND: Record<AttackSpec["kind"], Family | null> = {
  direct: "rapid", volley: "rapid", pierce: "rapid",
  splash: "heavy", mortar: "heavy", quake: "heavy", execute: "heavy",
  chain: "electric", stun: "electric", disrupt: "electric", focus: "electric",
  slow: "control", net: "control", pull: "control",
  burn: "fire", corrode: "fire", decay: "fire",
  bleed: "traps", charge: "traps", pit: "traps", alarm: "traps",
  aura: null, income: null, detect: null, bounty: null, repair: null, mark: null,
};
export const familyOf = (d: TowerDefinition): Family | null => (d.placement === "path" ? "traps" : BY_KIND[d.attack.kind]);
/** Shots per family in a batch of drained events. */
export function shotsByFamily(events: readonly GameEvent[], content: ContentPack) {
  const out: Partial<Record<Family, number>> = {};
  for (const e of events) {
    if (e.type !== "shot") continue;
    const f = familyOf(content.towers[e.tower]);
    if (f) out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}
```

- [ ] **Step 4: Implement `src/audio/activity.ts`**

```ts
import { FAMILIES, type Family } from "./families";
// How busy each tower family is: every shot adds a little, and the level halves without shots.

export const HALF_LIFE = 1.5,
  PER_SHOT = 0.06;
export type Levels = Record<Family, number>;
export const silent = (): Levels => Object.fromEntries(FAMILIES.map((f) => [f, 0])) as Levels;
export class Activity {
  readonly levels: Levels = silent();
  private at: number | null = null;
  update(shots: Partial<Record<Family, number>>, now: number) {
    const keep = this.at === null ? 1 : 0.5 ** (Math.max(0, now - this.at) / HALF_LIFE);
    for (const f of FAMILIES) this.levels[f] = Math.min(1, this.levels[f] * keep + (shots[f] ?? 0) * PER_SHOT);
    this.at = now;
  }
}
```

- [ ] **Step 5: Run** both tests — Expected: PASS (2 + 1).

- [ ] **Step 6: Commit** `git add src/audio/families.ts src/audio/families.test.ts src/audio/activity.ts src/audio/activity.test.ts && git commit -m "Add tower families and their activity"`

---

### Task 2: Composed parts, calmer drums, slower themes

**Files:** Create `src/audio/parts.ts`; Test `src/audio/parts.test.ts`; Replace `src/audio/grooves.ts`, `src/audio/grooves.test.ts`; Modify `src/audio/harmony.ts` (`MUSIC`), `src/audio/harmony.test.ts` (tempo range)

**Interfaces:**
- Produces: `PARTS`, `partNote(family, step, level): { voice: number; velocity: number } | null`; `type Drum = "kick" | "snare" | "hat" | "stomp" | "bass"`, `layersFor(threat, heavies): Drum[]`, `hitsAt`, `arpIndex` (unchanged signature)

- [ ] **Step 1: Write the failing tests**

`src/audio/parts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FAMILIES } from "./families";
import { partNote } from "./parts";

describe("parts", () => {
  it("plays the core steps as soon as a family is active and the full figure only at full activity", () => {
    expect(partNote("rapid", 0, 0.01)).toBeNull();
    const first = partNote("rapid", 0, 0.1)!;
    expect(first.voice).toBe(0);
    expect(first.velocity).toBeCloseTo(0.46);
    expect(partNote("rapid", 14, 0.7)).toBeNull();
    expect(partNote("rapid", 14, 0.9)?.voice).toBe(3);
  });
  it("never writes more than eight notes per bar for any family", () => {
    for (const f of FAMILIES) expect(Array.from({ length: 16 }, (_, s) => partNote(f, s, 1)).filter(Boolean).length, f).toBeLessThanOrEqual(8);
  });
  it("answers the first rapid shot within a beat", () => {
    for (let s = 0; s < 16; s += 4) expect(partNote("rapid", s, 0.06)).not.toBeNull();
  });
});
```

Replace `src/audio/grooves.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { arpIndex, hitsAt, layersFor } from "./grooves";

describe("grooves", () => {
  it("plays no drums at low threat, then kick, backbeat, hats and bass, and a stomp for heavy enemies", () => {
    expect(layersFor(0.1, 0)).toEqual([]);
    expect(layersFor(0.3, 0)).toEqual(["kick"]);
    expect(layersFor(0.6, 0)).toEqual(["kick", "snare"]);
    expect(layersFor(0.8, 2)).toEqual(["kick", "snare", "hat", "bass", "stomp"]);
  });
  it("hits only the playing parts on their steps", () => {
    expect(hitsAt("straight", 4, ["kick", "snare", "hat"])).toEqual(["snare", "hat"]);
    expect(hitsAt("straight", 8, ["stomp", "bass"])).toEqual(["stomp"]);
    expect(hitsAt("none", 0, ["kick"])).toEqual([]);
  });
  it("lets the arpeggio rise when bright and fall when dark", () => {
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "bright", 3))).toEqual([0, 1, 2, 0]);
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "dark", 3))).toEqual([2, 1, 0, 2]);
    expect([0, 1, 2, 3, 4].map((s) => arpIndex(s, "drive", 3))).toEqual([0, 1, 2, 1, 0]);
  });
});
```

In `src/audio/harmony.test.ts` change the tempo test bounds to `toBeGreaterThanOrEqual(84)` and `toBeLessThanOrEqual(104)` and its name to `"keeps every theme calm (84–104 BPM)"`.

- [ ] **Step 2: Run** `npx vitest run src/audio/parts.test.ts src/audio/grooves.test.ts src/audio/harmony.test.ts` — Expected: FAIL (parts missing; layers and tempos differ).

- [ ] **Step 3: Create `src/audio/parts.ts`**

```ts
import type { Family } from "./families";
// One composed 16-step part per tower family. A digit is the activity rank a step needs (1 plays as soon as the
// family is active, 4 only at full activity); `voices` gives the chord tone per step.

interface Part {
  steps: string;
  voices: readonly number[];
}
const tones = (s: string) => [...s].map(Number);
export const PARTS: Record<Family, Part> = {
  rapid: { steps: "1.3.1.3.1.3.1.4.", voices: tones("0020102000201030") },
  heavy: { steps: "1.......2.......", voices: tones("0000000000000000") },
  electric: { steps: "..2...1...2...1.", voices: tones("0020001000300020") },
  control: { steps: "1...............", voices: tones("0000000000000000") },
  fire: { steps: "3.1.3.1.3.1.3.1.", voices: tones("0000000000000000") },
  traps: { steps: "...1..2....1..2.", voices: tones("0000000000000000") },
};
/** Activity each rank needs. */
const NEED = [0.02, 0.3, 0.55, 0.8];
/** The family's note at a 1/16 step, or null when the step rests at this activity. */
export function partNote(family: Family, step: number, level: number): { voice: number; velocity: number } | null {
  const i = ((step % 16) + 16) % 16,
    rank = PARTS[family].steps[i];
  if (rank === "." || level < NEED[Number(rank) - 1]) return null;
  return { voice: PARTS[family].voices[i], velocity: 0.4 + 0.6 * level };
}
```

- [ ] **Step 4: Replace `src/audio/grooves.ts`**

```ts
import type { Color, Groove } from "./harmony";
// The enemies' rhythm section, 16 steps per bar ("x" = hit), and the arpeggio's path through the chord.

export type Drum = "kick" | "snare" | "hat" | "stomp" | "bass";
const GROOVES: Record<Exclude<Groove, "none">, Record<"kick" | "snare", string>> = {
  straight: { kick: "x.......x.......", snare: "....x.......x..." },
  half: { kick: "x.........x.....", snare: "........x......." },
  broken: { kick: "x..x......x.....", snare: "....x.......x..x" },
};
/** Parts every groove shares: 8th hats, a bass pulse, and a heavy enemy's stomp on beats 1 and 3. */
const SHARED: Record<"hat" | "stomp" | "bass", string> = { hat: "x.x.x.x.x.x.x.x.", stomp: "x.......x.......", bass: "x.....x...x....." };
/** No drums at low threat; then the kick, a backbeat, and at the top hats and a bass pulse; heavy enemies stomp. */
export function layersFor(threat: number, heavies: number): Drum[] {
  const parts: Drum[] = [];
  if (threat >= 0.25) parts.push("kick");
  if (threat >= 0.5) parts.push("snare");
  if (threat >= 0.75) parts.push("hat", "bass");
  if (heavies > 0) parts.push("stomp");
  return parts;
}
export function hitsAt(groove: Groove, step: number, layers: readonly Drum[]): Drum[] {
  if (groove === "none") return [];
  const i = ((step % 16) + 16) % 16;
  return layers.filter((d) => (d === "hat" || d === "stomp" || d === "bass" ? SHARED[d] : GROOVES[groove][d])[i] === "x");
}
/** Chord-tone index per step through a chord of `n` tones: rising when the defense is ahead, falling when it is behind, up and down when even. */
export function arpIndex(step: number, color: Color, n: number) {
  const s = Math.abs(step);
  if (color === "bright") return s % n;
  if (color === "dark") return n - 1 - (s % n);
  const period = 2 * n - 2,
    p = s % period;
  return p < n ? p : period - p;
}
```

- [ ] **Step 5: Replace the `MUSIC` table in `src/audio/harmony.ts`**

```ts
export const MUSIC: Record<DroneId, ThemeMusic> = {
  menu: m(84, 33, "aeolian", [0, 5, 2, 6], "none"),
  outpost: m(96, 33, "aeolian", [0, 5, 2, 6], "straight"),
  lock: m(92, 34, "dorian", [0, 3, 0, 6], "straight"),
  shard: m(100, 35, "dorian", [0, 3, 4, 0], "broken"),
  ember: m(98, 31, "phrygian", [0, 1, 0, 6], "broken"),
  core: m(96, 33, "harmonic", [0, 5, 3, 4], "straight"),
  frost: m(88, 36, "dorian", [0, 3, 6, 4], "half"),
  toxic: m(94, 32, "phrygian", [0, 1, 6, 0], "broken"),
  orbit: m(86, 38, "aeolian", [0, 5, 6, 4], "half"),
  ruin: m(90, 30, "aeolian", [0, 3, 5, 4], "half"),
  rift: m(102, 28, "phrygian", [0, 1, 3, 1], "broken"),
  dune: m(94, 33, "dorian", [0, 6, 3, 0], "straight"),
  abyss: m(84, 26, "aeolian", [0, 5, 6, 0], "half"),
  storm: m(104, 31, "aeolian", [0, 6, 5, 4], "broken"),
  jungle: m(98, 35, "dorian", [0, 6, 3, 0], "straight"),
  volcano: m(100, 29, "harmonic", [0, 5, 1, 4], "straight"),
  geode: m(90, 37, "aeolian", [0, 3, 6, 4], "half"),
  gear: m(100, 34, "dorian", [0, 6, 3, 4], "straight"),
  tide: m(88, 32, "aeolian", [0, 5, 3, 4], "half"),
};
```

- [ ] **Step 6: Run** the three tests — Expected: PASS. (`sequencer.test.ts` may now fail on its arpeggio/drum expectations; Task 5 replaces it.)

- [ ] **Step 7: Commit** `git add src/audio/parts.ts src/audio/parts.test.ts src/audio/grooves.ts src/audio/grooves.test.ts src/audio/harmony.ts src/audio/harmony.test.ts && git commit -m "Compose family parts; calmer drums and tempos"`

---

### Task 3: Effects only where they help

**Files:** Replace `src/audio/recipes.ts`, `src/audio/cues.ts`, `src/audio/recipes.test.ts`, `src/audio/cues.test.ts`; Modify `src/audio/mixer.ts`, `src/audio/mixer.test.ts`, `src/audio/score.test.ts`

**Interfaces:**
- Produces: `COMBAT_CUES = ["blast", "kill", "evade", "overload", "income", "repair"]`, `Pool = "combat" | "flow" | "ui"`, `TIMING` for the remaining cues; `cuesFor` returns no cues for shots and `blast` only for heavy impacts

- [ ] **Step 1: Write the failing tests**

Replace `src/audio/recipes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSamples } from "./zzfx";
import { COMBAT_CUES, FLOW_CUES, RECIPES, TIMING, UI_CUES } from "./recipes";

describe("cue recipes", () => {
  it("cover every cue with a short, non-empty sound in the right pool", () => {
    const pools = { combat: COMBAT_CUES, flow: FLOW_CUES, ui: UI_CUES } as const;
    for (const [pool, ids] of Object.entries(pools))
      for (const id of ids) {
        const r = RECIPES[id];
        expect(r.pool, id).toBe(pool);
        expect(r.cap, id).toBeGreaterThanOrEqual(1);
        const n = buildSamples(r.params, 8000).length;
        expect(n, id).toBeGreaterThan(0);
        expect(n, id).toBeLessThan(3 * 8000);
      }
  });
  it("keeps interface feedback instant and thins kills and blasts to about one per beat", () => {
    for (const id of ["reject", "click", "hover"] as const) expect(TIMING[id].grid, id).toBe(0);
    expect(RECIPES.kill.gap).toBeGreaterThanOrEqual(0.5);
    expect(RECIPES.blast.gap).toBeGreaterThanOrEqual(0.5);
  });
});
```

Replace `src/audio/cues.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, GameState, TowerId } from "../core/types";
import { burstGain, cuesFor, newlyEliminated, ReactorWatch } from "./cues";

const towers = Object.values(DEFAULT_CONTENT.towers);
const idOf = (pick: (d: (typeof towers)[number]) => boolean) => towers.find(pick)!.id as TowerId;
const direct = idOf((d) => d.attack.kind === "direct" && !d.placement),
  splash = idOf((d) => d.attack.kind === "splash" && !d.placement);
const at = { x: 0, y: 0 };
const kill: GameEvent = { type: "kill", at, color: 0, reward: 1 };

describe("cuesFor", () => {
  it("leaves shots to the instrument parts and voices only heavy impacts", () => {
    expect(cuesFor([{ type: "shot", tower: direct, from: at, to: at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([]);
    expect(cuesFor([{ type: "impact", tower: splash, at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([{ id: "blast", voice: 0, gain: 1 }]);
    expect(cuesFor([{ type: "impact", tower: direct, at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([]);
  });
  it("merges a burst into one louder cue", () => {
    expect(cuesFor([kill, kill, kill], DEFAULT_CONTENT, "game")).toEqual([{ id: "kill", voice: 0, gain: burstGain(3) }]);
    expect(burstGain(1)).toBe(1);
    expect(burstGain(50)).toBe(1.5);
  });
  it("gives building and upgrading their own chord tones", () => {
    const build: GameEvent = { type: "build", at, tower: direct, color: 0 },
      upgrade: GameEvent = { type: "upgrade", at, tower: direct, color: 0 };
    expect(cuesFor([build, upgrade], DEFAULT_CONTENT, "game").map((c) => c.voice)).toEqual([2, 3]);
  });
  it("keeps only flow cues while the menu is open", () => {
    const events: GameEvent[] = [kill, { type: "leak", at, amount: 1 }, { type: "end", result: "lost" }];
    expect(cuesFor(events, DEFAULT_CONTENT, "menu").map((c) => c.id)).toEqual(["leak", "lost"]);
  });
});

describe("ReactorWatch", () => {
  const state = (lives: number) => ({ lives }) as GameState;
  it("fires once when the reactor falls to 30 % and never on a new state", () => {
    const w = new ReactorWatch(),
      s = state(20);
    expect(w.crossed(s, 20)).toBe(false);
    s.lives = 6;
    expect(w.crossed(s, 20)).toBe(true);
    s.lives = 5;
    expect(w.crossed(s, 20)).toBe(false);
    expect(w.crossed(state(3), 20)).toBe(false);
  });
});

describe("newlyEliminated", () => {
  it("reports opponents who just dropped out, never the local seat", () => {
    expect(newlyEliminated([null, null, null], [120, null, 120], 0)).toEqual([2]);
    expect(newlyEliminated([], [null, null], 1)).toEqual([]);
  });
});
```

In `src/audio/mixer.test.ts` replace every `"bolt"` with `"kill"` and every `"impact"` with `"blast"`, and delete the test `"keeps the drums playing when the combat pool is full"`.

In `src/audio/score.test.ts`: in "places a pitched cue …" replace `"bolt"`/`RECIPES.bolt`/`TIMING.bolt` with `"income"`/`RECIPES.income`/`TIMING.income`; replace `expect(s.noteAt("kick", 3, 0.6, 2)).toEqual({ id: "kick", rate: 1, gain: 0.6, at: 2 });` with `expect(s.noteAt("blast", 3, 0.6, 2)).toEqual({ id: "blast", rate: 1, gain: 0.6, at: 2 });`.

- [ ] **Step 2: Run** `npx vitest run src/audio/recipes.test.ts src/audio/cues.test.ts src/audio/mixer.test.ts src/audio/score.test.ts` — Expected: FAIL (shots still map to cues; gaps too short).

- [ ] **Step 3: Replace `src/audio/recipes.ts`**

```ts
import type { Grid } from "./clock";
import type { ZzfxParams } from "./zzfx";
// ZzFX recipes for the short effects that are not part of the music: a few combat accents, alerts, stinger
// fallbacks and interface clicks. Tune them in the ZzFX designer (https://killedbyapixel.github.io/ZzFX) and on
// /gallery.html?sound.

export const COMBAT_CUES = ["blast", "kill", "evade", "overload", "income", "repair"] as const;
export const FLOW_CUES = ["build", "sell", "upgrade", "leak", "waveStart", "waveEnd", "won", "lost", "lowReactor", "reject", "incoming", "eliminated", "boss"] as const;
export const UI_CUES = ["click", "hover"] as const;
export type CueId = (typeof COMBAT_CUES)[number] | (typeof FLOW_CUES)[number] | (typeof UI_CUES)[number];
export type Pool = "combat" | "flow" | "ui";
export interface CueSpec {
  params: ZzfxParams;
  pool: Pool;
  /** Simultaneous voices of this cue. */
  cap: number;
  /** Minimum seconds between two starts of this cue. */
  gap: number;
  /** A full pool gives way to a higher priority. */
  priority: number;
  /** Dips the music bus. */
  duck?: boolean;
}
const combat = (params: ZzfxParams, cap: number, gap: number, priority = 1): CueSpec => ({ params, pool: "combat", cap, gap, priority });
const flow = (params: ZzfxParams, priority: number, duck = false): CueSpec => ({ params, pool: "flow", cap: 2, gap: 0.08, priority, duck });
const ui = (params: ZzfxParams, gap: number): CueSpec => ({ params, pool: "ui", cap: 2, gap, priority: 1 });

export const RECIPES: Record<CueId, CueSpec> = {
  blast: combat([0.45, 0.05, 70, 0, 0.05, 0.35, 4, 2, -2, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.5, 0.05, 0, -700], 1, 0.5, 2),
  kill: combat([0.15, 0.05, 1320, 0, 0.02, 0.12, 0, 1, 0, 0, 660, 0.03, 0, 0, 0, 0, 0.05, 0.5, 0, 0, -5000], 1, 0.5, 2),
  evade: combat([0.12, 0.05, 900, 0.01, 0, 0.08, 4, 1, 30, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 2500], 1, 0.3, 0),
  overload: combat([0.3, 0, 440, 0, 0.1, 0.4, 0, 1, -8, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.05, 0, -1500], 1, 0.3, 3),
  income: combat([0.12, 0.05, 1760, 0, 0.01, 0.06, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 1, 0.3, 0),
  repair: combat([0.15, 0, 660, 0.02, 0.05, 0.15, 0, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -3000], 1, 0.3, 0),
  build: flow([0.35, 0, 523, 0, 0.03, 0.12, 1, 1, 0, 0, 262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  sell: flow([0.3, 0, 784, 0, 0.03, 0.12, 1, 1, 0, 0, -262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  upgrade: flow([0.35, 0, 523, 0, 0.06, 0.2, 0, 1, 0, 0, 262, 0.05, 0.1, 0, 0, 0, 0, 0.7, 0.01, 0, -4000], 2),
  leak: flow([0.5, 0, 80, 0, 0.08, 0.4, 1, 1, -3, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.8, 0.05, 0.3, -800], 3, true),
  waveStart: flow([0.45, 0, 220, 0.05, 0.3, 0.5, 2, 1, 0, 0, 110, 0.2, 0, 0, 0, 0, 0.12, 0.6, 0.1, 0.2, -1800], 3),
  waveEnd: flow([0.4, 0, 659, 0.02, 0.2, 0.5, 0, 1, 0, 0, -165, 0.15, 0, 0, 0, 0, 0.1, 0.6, 0.05, 0, -4000], 3),
  won: flow([0.5, 0, 523, 0.02, 0.5, 0.8, 0, 1, 0, 0, 262, 0.12, 0.25, 0, 0, 0, 0.15, 0.7, 0.1, 0, -5000], 4, true),
  lost: flow([0.5, 0, 330, 0.02, 0.5, 1, 2, 1, -1, 0, -55, 0.25, 0, 0, 0, 0, 0.2, 0.6, 0.1, 0.2, -1500], 4, true),
  lowReactor: flow([0.35, 0, 880, 0, 0.08, 0.08, 0, 1, 0, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.8, 0, 0, -3000], 4, true),
  reject: flow([0.25, 0, 160, 0, 0.04, 0.08, 1, 1, 0, 0, -40, 0.03, 0, 0, 0, 0, 0, 0.8, 0, 0, -1500], 1),
  incoming: flow([0.35, 0, 440, 0.01, 0.15, 0.2, 0, 1, 0, 0, 110, 0.08, 0.12, 0, 0, 0, 0, 0.7, 0, 0, -2500], 3),
  eliminated: flow([0.4, 0, 392, 0.02, 0.3, 0.6, 2, 1, -2, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.6, 0.05, 0, -1500], 3),
  boss: flow([0.55, 0, 110, 0.02, 0.5, 0.6, 2, 1, 0, 0, 55, 0.15, 0.3, 0.1, 0, 0, 0.12, 0.7, 0.05, 0.15, -1200], 4, true),
  click: ui([0.15, 0, 1200, 0, 0, 0.025, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -5000], 0.03),
  hover: ui([0.05, 0, 2400, 0, 0, 0.015, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 0.05),
};

/** When a cue may sound (its beat grid) and whether it is pitched to the current chord. */
export interface Timing {
  grid: Grid;
  pitched: boolean;
}
const t = (grid: Grid, pitched: boolean): Timing => ({ grid, pitched });
export const TIMING: Record<CueId, Timing> = {
  blast: t(4, false), kill: t(16, true), evade: t(16, false), overload: t(4, true), income: t(16, true), repair: t(8, true),
  build: t(16, true), sell: t(16, true), upgrade: t(16, true), leak: t(8, false),
  waveStart: t(1, true), waveEnd: t(1, true), won: t(1, true), lost: t(1, true), eliminated: t(1, true), boss: t(1, true),
  lowReactor: t(4, false), incoming: t(4, false),
  reject: t(0, false), click: t(0, false), hover: t(0, false),
};
```

- [ ] **Step 4: Replace `src/audio/cues.ts`**

```ts
import type { AttackSpec, ContentPack, GameEvent, GameState } from "../core/types";
import { RECIPES, type CueId } from "./recipes";
// Drained game events → effect cues. Shots are not cues: they raise their tower family's activity, which plays its
// instrument part (`Conductor`). Only heavy impacts make an effect sound.

export interface Cue {
  id: CueId;
  /** Chord-tone index for pitched cues. */
  voice: number;
  gain: number;
}
export type View = "menu" | "game";
const BLASTS = new Set<AttackSpec["kind"]>(["splash", "mortar", "charge"]);
const PLAIN: Partial<Record<GameEvent["type"], CueId>> = {
  kill: "kill", evade: "evade", overload: "overload", leak: "leak", build: "build", sell: "sell", upgrade: "upgrade",
  income: "income", repair: "repair", waveStart: "waveStart", waveEnd: "waveEnd",
};
/** Building rises to the fifth, upgrading to the top of the chord; other flow cues sit on the root. */
const FLOW_VOICE: Partial<Record<CueId, number>> = { build: 2, upgrade: 3 };
export const burstGain = (n: number) => Math.min(1.5, 1 + 0.1 * (n - 1));

function cueOf(e: GameEvent, content: ContentPack): { id: CueId; voice: number } | null {
  switch (e.type) {
    case "impact":
      return BLASTS.has(content.towers[e.tower].attack.kind) ? { id: "blast", voice: 0 } : null;
    case "end":
      return { id: e.result, voice: 0 };
    default: {
      const id = PLAIN[e.type];
      return id ? { id, voice: FLOW_VOICE[id] ?? 0 } : null;
    }
  }
}
/** One cue per sound and voice in this frame; in the menu only flow cues (a multiplayer wave runs on). */
export function cuesFor(events: readonly GameEvent[], content: ContentPack, view: View): Cue[] {
  const merged = new Map<string, { id: CueId; voice: number; n: number }>();
  for (const e of events) {
    const c = cueOf(e, content);
    if (!c || (view === "menu" && RECIPES[c.id].pool === "combat")) continue;
    const key = `${c.id}@${c.voice}`,
      m = merged.get(key);
    if (m) m.n++;
    else merged.set(key, { ...c, n: 1 });
  }
  return [...merged.values()].map(({ id, voice, n }) => ({ id, voice, gain: burstGain(n) }));
}
/** Reports the reactor falling to 30 % once per crossing; a new state (restart, mission change) starts fresh. */
export class ReactorWatch {
  private seen: { state: GameState; lives: number } | null = null;
  crossed(state: GameState, max: number) {
    const before = this.seen?.state === state ? this.seen.lives : undefined;
    this.seen = { state, lives: state.lives };
    return before !== undefined && max > 0 && state.lives > 0 && before / max > 0.3 && state.lives / max <= 0.3;
  }
}
/** Seats whose elimination tick appeared since the last frame, without the local player (the `lost` cue covers them). */
export function newlyEliminated(before: readonly (number | null)[], after: readonly (number | null)[], local: number) {
  return after.flatMap((tick, i) => (tick !== null && (before[i] ?? null) === null && i !== local ? [i] : []));
}
```

- [ ] **Step 5: Edit `src/audio/mixer.ts`** — `export const POOL_CAP: Record<Pool, number> = { combat: 24, flow: 8, ui: 4 };`

- [ ] **Step 6: Run** the four tests — Expected: PASS.

- [ ] **Step 7: Commit** `git add src/audio/recipes.ts src/audio/recipes.test.ts src/audio/cues.ts src/audio/cues.test.ts src/audio/mixer.ts src/audio/mixer.test.ts src/audio/score.test.ts && git commit -m "Keep effects only where they help; shots feed the parts"`

---

### Task 4: Stingers

**Files:** Create `src/audio/stingers.ts`, `src/audio/instruments.ts` (type and registers only in this task); Test `src/audio/stingers.test.ts`

**Interfaces:**
- Produces: `type Instrument = "pluck" | "bell" | "bass" | "swell" | "tom" | "kick" | "snare" | "hat" | "shaker" | "click"`, `REGISTER: Partial<Record<Instrument, number>>`; `interface Stinger { notes: readonly (readonly [Instrument, number, number, number])[]; duck?: boolean }`, `STINGERS: Partial<Record<CueId, Stinger>>`

- [ ] **Step 1: Write the failing test** `src/audio/stingers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STINGERS } from "./stingers";

describe("stingers", () => {
  it("re-voice the musical flow cues within one bar", () => {
    expect(Object.keys(STINGERS).sort()).toEqual(["boss", "build", "lost", "sell", "upgrade", "waveEnd", "waveStart", "won"]);
    for (const [id, s] of Object.entries(STINGERS))
      for (const [, , offset, velocity] of s!.notes) {
        expect(offset, id).toBeGreaterThanOrEqual(0);
        expect(offset, id).toBeLessThan(16);
        expect(velocity, id).toBeGreaterThan(0);
        expect(velocity, id).toBeLessThanOrEqual(1);
      }
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/audio/stingers.test.ts` — Expected: FAIL.

- [ ] **Step 3: Create `src/audio/instruments.ts`** (Task 6 adds the voices below these lines)

```ts
// Synthesized instruments for the music: plain Web Audio voices with filter and amplitude envelopes (parameters after
// Tone.js's MonoSynth and FMSynth defaults). Each voice schedules one note and returns when it has died away.

export type Instrument = "pluck" | "bell" | "bass" | "swell" | "tom" | "kick" | "snare" | "hat" | "shaker" | "click";
/** Pitched instruments play their chord tone in the octave around this frequency (Hz); the others are unpitched. */
export const REGISTER: Partial<Record<Instrument, number>> = { pluck: 520, bell: 1040, bass: 65, swell: 262 };
```

- [ ] **Step 4: Create `src/audio/stingers.ts`**

```ts
import type { Instrument } from "./instruments";
import type { CueId } from "./recipes";
// Musical flow cues as short instrument phrases on the beat grid: [instrument, chord tone, 1/16 offset, velocity].

export interface Stinger {
  notes: readonly (readonly [Instrument, number, number, number])[];
  /** Dips the music while it plays. */
  duck?: boolean;
}
export const STINGERS: Partial<Record<CueId, Stinger>> = {
  build: { notes: [["pluck", 2, 0, 0.7]] },
  sell: { notes: [["pluck", 0, 0, 0.5]] },
  upgrade: { notes: [["pluck", 1, 0, 0.6], ["bell", 3, 1, 0.6]] },
  waveStart: { notes: [["swell", 0, 0, 0.7], ["bell", 0, 0, 0.5]] },
  waveEnd: { notes: [["bell", 0, 0, 0.5], ["bell", 2, 2, 0.45], ["bell", 4, 4, 0.4]] },
  won: { notes: [["bell", 0, 0, 0.7], ["bell", 1, 2, 0.6], ["bell", 2, 4, 0.6], ["swell", 0, 0, 0.8]], duck: true },
  lost: { notes: [["bass", 0, 0, 0.9], ["swell", 0, 0, 0.7]], duck: true },
  boss: { notes: [["bass", 0, 0, 1], ["tom", 0, 4, 0.8], ["bass", 0, 8, 0.9], ["tom", 0, 12, 0.8]], duck: true },
};
```

- [ ] **Step 5: Run** the test — Expected: PASS.

- [ ] **Step 6: Commit** `git add src/audio/stingers.ts src/audio/stingers.test.ts src/audio/instruments.ts && git commit -m "Add instrument stingers for musical flow cues"`

---

### Task 5: Sequencer plays the parts

**Files:** Replace `src/audio/sequencer.ts`, `src/audio/sequencer.test.ts`

**Interfaces:**
- Consumes: `Levels`, `silent` (1), `FAMILIES`, `Family` (1), `partNote` (2), `hitsAt`, `arpIndex`, `Drum` (2)
- Produces: `interface Parts { drums; arp; extent; color; activity: Readonly<Levels> }`, `Beat` adds `{ kind: "part"; family; voice; velocity; at }`, `schedule`, `stepsIn`, `Sequencer` (unchanged API)

- [ ] **Step 1: Replace `src/audio/sequencer.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { silent } from "./activity";
import { chordOf, MUSIC, padChord } from "./harmony";
import { schedule, Sequencer, stepsIn, type Parts } from "./sequencer";

const clock = { origin: 0, bpm: 120 }; // 1/16 = 0.125 s
const parts: Parts = { drums: ["kick"], arp: false, extent: 3, color: "drive", activity: silent() };
describe("stepsIn", () => {
  it("lists the 1/16 steps inside the half-open window", () => {
    expect(stepsIn(clock, 0.1, 0.375)).toEqual([
      { time: 0.125, step: 1 },
      { time: 0.25, step: 2 },
    ]);
  });
});
describe("schedule", () => {
  it("changes the chord on the bar line and plays the groove's hits", () => {
    expect(schedule(clock, MUSIC.outpost, parts, 0, 0.25)).toEqual([
      { kind: "chord", notes: chordOf(MUSIC.outpost, 0), at: 0 },
      { kind: "hit", drum: "kick", at: 0 },
    ]);
  });
  it("plays the arpeggio in 8ths through a widened, darkened chord", () => {
    expect(schedule(clock, MUSIC.outpost, { ...parts, drums: [], arp: true, extent: 4, color: "dark" }, 0, 0.25)).toEqual([
      { kind: "chord", notes: padChord(chordOf(MUSIC.outpost, 0, 4), "dark"), at: 0 },
      { kind: "arp", voice: 3, at: 0 },
    ]);
  });
  it("plays an active family's part", () => {
    expect(schedule(clock, MUSIC.outpost, { ...parts, drums: [], activity: { ...silent(), rapid: 1 } }, 0, 0.25)).toEqual([
      { kind: "chord", notes: chordOf(MUSIC.outpost, 0), at: 0 },
      { kind: "part", family: "rapid", voice: 0, velocity: 1, at: 0 },
    ]);
  });
});
describe("Sequencer", () => {
  it("schedules each moment once and nothing while the audio clock stands still", () => {
    let now = 0;
    const windows: [number, number][] = [];
    const seq = new Sequencer(() => now, (from, to) => windows.push([from, to]));
    seq.tick();
    now = 0.05;
    seq.tick();
    seq.tick();
    expect(windows).toHaveLength(2);
    [
      [0, 0.1],
      [0.1, 0.15],
    ].forEach(([from, to], i) => {
      expect(windows[i][0]).toBeCloseTo(from);
      expect(windows[i][1]).toBeCloseTo(to);
    });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/audio/sequencer.test.ts` — Expected: FAIL (`activity` unknown, no parts, arp on every step).

- [ ] **Step 3: Replace `src/audio/sequencer.ts`**

```ts
import type { Levels } from "./activity";
import { nextSlot, stepLength, type Clock } from "./clock";
import { FAMILIES, type Family } from "./families";
import { arpIndex, hitsAt, type Drum } from "./grooves";
import { chordOf, padChord, type Color, type Extent, type ThemeMusic } from "./harmony";
import { partNote } from "./parts";
// Lookahead scheduling after Chris Wilson's "A Tale of Two Clocks": a coarse timer schedules everything due in the
// next window on the precise audio clock.

const TICK_MS = 25,
  AHEAD = 0.1;
/** What the music plays right now: the enemies' drums, the towers' parts and harmony, the mood. */
export interface Parts {
  drums: readonly Drum[];
  arp: boolean;
  extent: Extent;
  color: Color;
  activity: Readonly<Levels>;
}
export type Beat =
  | { kind: "chord"; notes: number[]; at: number }
  | { kind: "hit"; drum: Drum; at: number }
  | { kind: "arp"; voice: number; at: number }
  | { kind: "part"; family: Family; voice: number; velocity: number; at: number };

/** The 1/16 steps with `from <= time < to`. */
export function stepsIn(c: Clock, from: number, to: number) {
  const len = stepLength(c, 16),
    out: { time: number; step: number }[] = [];
  for (let step = Math.round((nextSlot(c, from, 16) - c.origin) / len); ; step++) {
    const time = c.origin + step * len;
    if (time >= to - 1e-9) return out;
    out.push({ time, step });
  }
}
/** Pad chords on bar lines, drum hits, the families' parts and the 8th-note arpeggio in the window. */
export function schedule(c: Clock, music: ThemeMusic, parts: Parts, from: number, to: number): Beat[] {
  const out: Beat[] = [];
  for (const { time, step } of stepsIn(c, from, to)) {
    if (((step % 16) + 16) % 16 === 0)
      out.push({ kind: "chord", notes: padChord(chordOf(music, Math.floor(step / 16), parts.extent), parts.color), at: time });
    for (const drum of hitsAt(music.groove, step, parts.drums)) out.push({ kind: "hit", drum, at: time });
    for (const family of FAMILIES) {
      const note = partNote(family, step, parts.activity[family]);
      if (note) out.push({ kind: "part", family, ...note, at: time });
    }
    if (parts.arp && step % 2 === 0) out.push({ kind: "arp", voice: arpIndex(step / 2, parts.color, parts.extent), at: time });
  }
  return out;
}
export class Sequencer {
  private until = -Infinity;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private now: () => number,
    private window: (from: number, to: number) => void,
  ) {}
  start() {
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  /** Hands out the part of the next window not scheduled yet; a frozen clock (suspended context) yields nothing. */
  tick() {
    const now = this.now(),
      from = Math.max(this.until, now),
      to = now + AHEAD;
    if (to <= from) return;
    this.window(from, to);
    this.until = to;
  }
}
```

- [ ] **Step 4: Run** `npx vitest run src/audio` — Expected: PASS for all audio tests.

- [ ] **Step 5: Commit** `git add src/audio/sequencer.ts src/audio/sequencer.test.ts && git commit -m "Sequence the families' parts and an 8th-note arpeggio"`

---

### Task 6: Instruments, reverb, engine

**Files:** Modify `src/audio/instruments.ts` (append voices and reverb), `src/audio/ambience.ts` (context type); Replace `src/audio/engine.ts`

**Interfaces:**
- Produces: `INSTRUMENTS: Record<Instrument, Play>`, `impulse(ctx, seconds?, decay?): AudioBuffer`; `AudioEngine` takes `BaseAudioContext`, adds `instrument(name, hz, at, velocity, pan): boolean` and public `duck(at)`

No unit tests (Web Audio); verified by `tsc`, Vitest staying green, the Conductor's recorder tests (Task 7) and the renders (Task 9).

- [ ] **Step 1: Append to `src/audio/instruments.ts`**

```ts
type Play = (ctx: BaseAudioContext, out: AudioNode, at: number, hz: number, velocity: number, noise: AudioBuffer) => number;

/** Gain that rises to `peak` in `attack` s and fades out over about `decay` s. */
function envelope(ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setTargetAtTime(0, at + attack, decay / 4);
  return g;
}
const pluck: Play = (ctx, out, at, hz, v) => {
  const o = ctx.createOscillator(),
    f = ctx.createBiquadFilter(),
    g = envelope(ctx, at, 0.35 * v, 0.004, 0.45),
    end = at + 0.5;
  o.type = "triangle";
  o.frequency.value = hz;
  f.type = "lowpass";
  f.Q.value = 1;
  f.frequency.setValueAtTime(hz * 6, at);
  f.frequency.setTargetAtTime(hz * 1.5, at, 0.08);
  o.connect(f).connect(g).connect(out);
  o.start(at);
  o.stop(end);
  return end;
};
const bell: Play = (ctx, out, at, hz, v) => {
  const carrier = ctx.createOscillator(),
    modulator = ctx.createOscillator(),
    index = ctx.createGain(),
    g = envelope(ctx, at, 0.22 * v, 0.002, 1.6),
    end = at + 1.7;
  carrier.frequency.value = hz;
  modulator.frequency.value = hz * 3.5;
  index.gain.setValueAtTime(hz * 2, at);
  index.gain.setTargetAtTime(0, at, 0.3);
  modulator.connect(index).connect(carrier.frequency);
  carrier.connect(g).connect(out);
  for (const o of [carrier, modulator]) {
    o.start(at);
    o.stop(end);
  }
  return end;
};
const bass: Play = (ctx, out, at, hz, v) => {
  const sine = ctx.createOscillator(),
    saw = ctx.createOscillator(),
    sawGain = ctx.createGain(),
    f = ctx.createBiquadFilter(),
    g = envelope(ctx, at, 0.45 * v, 0.008, 0.6),
    end = at + 0.7;
  sine.frequency.value = hz;
  saw.type = "sawtooth";
  saw.frequency.value = hz;
  sawGain.gain.value = 0.25;
  f.type = "lowpass";
  f.frequency.value = 280;
  sine.connect(g);
  saw.connect(sawGain).connect(f).connect(g);
  g.connect(out);
  for (const o of [sine, saw]) {
    o.start(at);
    o.stop(end);
  }
  return end;
};
const swell: Play = (ctx, out, at, hz, v) => {
  const g = ctx.createGain(),
    f = ctx.createBiquadFilter(),
    end = at + 2.6;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.12 * v, at + 0.45);
  g.gain.setTargetAtTime(0, at + 0.6, 0.5);
  f.type = "lowpass";
  f.frequency.value = 1800;
  f.connect(g).connect(out);
  for (const [ratio, cents] of [[1, -7], [1.5, 5], [2, 0]]) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = hz * ratio;
    o.detune.value = cents;
    o.connect(f);
    o.start(at);
    o.stop(end);
  }
  return end;
};
/** A pitch-swept sine: kick and tom. */
const drum =
  (from: number, to: number, sweep: number, decay: number, peak: number): Play =>
  (ctx, out, at, _hz, v) => {
    const o = ctx.createOscillator(),
      g = envelope(ctx, at, peak * v, 0.002, decay),
      end = at + decay + 0.05;
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(to, at + sweep);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(end);
    return end;
  };
/** Filtered noise: snare, hat, shaker. The read position follows the time, so hits differ but repeat across runs. */
const noisy =
  (type: BiquadFilterType, freq: number, q: number, decay: number, peak: number): Play =>
  (ctx, out, at, _hz, v, noise) => {
    const s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = envelope(ctx, at, peak * v, 0.001, decay),
      end = at + decay + 0.02;
    s.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    s.connect(f).connect(g).connect(out);
    s.start(at, (at * 7.31) % 1.5);
    s.stop(end);
    return end;
  };
const click: Play = (ctx, out, at, _hz, v) => {
  const o = ctx.createOscillator(),
    g = envelope(ctx, at, 0.25 * v, 0.001, 0.05),
    end = at + 0.07;
  o.frequency.value = 1700;
  o.connect(g).connect(out);
  o.start(at);
  o.stop(end);
  return end;
};
export const INSTRUMENTS: Record<Instrument, Play> = {
  pluck,
  bell,
  bass,
  swell,
  tom: drum(140, 70, 0.2, 0.4, 0.45),
  kick: drum(120, 45, 0.12, 0.35, 0.7),
  snare: noisy("bandpass", 1800, 0.7, 0.16, 0.3),
  hat: noisy("highpass", 7000, 0.7, 0.05, 0.12),
  shaker: noisy("bandpass", 5200, 1.5, 0.07, 0.1),
  click,
};
/** A stereo reverb impulse of decaying noise (the technique Tone.js's Reverb renders offline), from xorshift32. */
export function impulse(ctx: BaseAudioContext, seconds = 2.4, decay = 3) {
  const length = Math.floor(ctx.sampleRate * seconds),
    b = ctx.createBuffer(2, length, ctx.sampleRate);
  let x = 0x2545f491;
  for (let ch = 0; ch < 2; ch++) {
    const data = b.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      data[i] = (((x >>> 0) / 0xffffffff) * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return b;
}
```

- [ ] **Step 2: Edit `src/audio/ambience.ts`** — in the constructor change `private ctx: AudioContext,` to `private ctx: BaseAudioContext,`.

- [ ] **Step 3: Replace `src/audio/engine.ts`**

```ts
import { Ambience } from "./ambience";
import { addDuck, type Span } from "./duck";
import { impulse, INSTRUMENTS, type Instrument } from "./instruments";
import { admit, type Voice } from "./mixer";
import { RECIPES, TIMING, type CueId } from "./recipes";
import type { Note } from "./score";
import type { SoundSettings } from "./settings";
import { buildSamples } from "./zzfx";
// Buses: sfx and ui → master; music (drone and instruments) → duck → master; music and sfx also feed one reverb.
// master → gentle compressor → limiter → speakers. Works on an OfflineAudioContext too (scripts/render-music.ts).

/** Bus gain scale, so full sliders leave headroom. */
const HEADROOM = 0.5,
  DUCK_LEVEL = 0.4,
  DUCK_TIME = 0.6,
  /** Notes one instrument may sound at once. */
  POLYPHONY = 6;
const BUS_OF = { combat: "sfx", flow: "sfx", ui: "ui" } as const;
type Playing = Voice & { source: AudioBufferSourceNode };

export class AudioEngine {
  readonly ambience: Ambience;
  private master: GainNode;
  private bus: Record<"sfx" | "ui" | "music", GainNode>;
  private duckGain: GainNode;
  private noise: AudioBuffer;
  private buffers = new Map<CueId, AudioBuffer>();
  private voices: Playing[] = [];
  private last = new Map<CueId, number>();
  private ducks: Span[] = [];
  private notes = new Map<Instrument, number[]>();
  constructor(readonly ctx: BaseAudioContext) {
    const compressor = ctx.createDynamicsCompressor(),
      limiter = ctx.createDynamicsCompressor(),
      reverb = ctx.createConvolver(),
      wet = ctx.createGain();
    compressor.threshold.value = -20;
    compressor.knee.value = 10;
    compressor.ratio.value = 3;
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    compressor.connect(limiter).connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(compressor);
    reverb.buffer = impulse(ctx);
    wet.gain.value = 0.3;
    reverb.connect(wet).connect(this.master);
    this.bus = { sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
    this.bus.sfx.connect(this.master);
    this.bus.ui.connect(this.master);
    this.duckGain = ctx.createGain();
    this.bus.music.connect(this.duckGain).connect(this.master);
    const send = (from: AudioNode, amount: number) => {
      const g = ctx.createGain();
      g.gain.value = amount;
      from.connect(g).connect(reverb);
    };
    send(this.duckGain, 0.35);
    send(this.bus.sfx, 0.12);
    this.noise = noiseBuffer(ctx);
    this.ambience = new Ambience(ctx, this.bus.music, this.noise);
  }
  volumes(s: SoundSettings) {
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, now, 0.05);
    for (const b of ["sfx", "ui", "music"] as const) this.bus[b].gain.setTargetAtTime(s[b] * HEADROOM, now, 0.05);
  }
  /** Schedules an effect at its time (never in the past); false when the mixer refused it. */
  play(note: Note) {
    const spec = RECIPES[note.id],
      now = this.ctx.currentTime,
      at = Math.max(now, note.at);
    this.voices = this.voices.filter((v) => v.end > now);
    const a = admit(note.id, spec, this.voices, this.last.get(note.id), at);
    if (!a.play) return false;
    if (a.steal) {
      a.steal.source.stop();
      this.voices = this.voices.filter((v) => v !== a.steal);
    }
    const buffer = this.buffer(note.id),
      source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      // Pitched notes stay in tune; unpitched ones vary a little. Render-side only.
      jitter = TIMING[note.id].pitched ? 0 : (spec.params[1] ?? 0.05);
    source.buffer = buffer;
    source.playbackRate.value = note.rate * (1 + jitter * (Math.random() * 2 - 1));
    gain.gain.value = note.gain;
    source.connect(gain).connect(this.bus[BUS_OF[spec.pool]]);
    source.start(at);
    this.voices.push({ cue: note.id, pool: spec.pool, priority: spec.priority, start: at, end: at + buffer.duration / source.playbackRate.value, source });
    this.last.set(note.id, at);
    if (spec.duck) this.duck(at);
    return true;
  }
  /** Plays a music note; false when the instrument already sounds too many notes at that time. */
  instrument(name: Instrument, hz: number, at: number, velocity: number, pan: number) {
    // Judged at the note's own time, so an offline render (currentTime stays 0 while scheduling) works the same.
    const start = Math.max(this.ctx.currentTime, at),
      sounding = (this.notes.get(name) ?? []).filter((end) => end > start);
    if (sounding.length >= POLYPHONY) return false;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.bus.music);
    sounding.push(INSTRUMENTS[name](this.ctx, panner, start, hz, velocity, this.noise));
    this.notes.set(name, sounding);
    return true;
  }
  /** Rewrites the duck automation from now on: the gain is only known now, never at a future `at`. */
  duck(at: number) {
    const g = this.duckGain.gain,
      now = this.ctx.currentTime;
    this.ducks = addDuck(this.ducks, { start: at, end: at + DUCK_TIME }, now);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    for (const d of this.ducks) {
      g.setTargetAtTime(DUCK_LEVEL, Math.max(now, d.start), 0.015);
      g.setTargetAtTime(1, d.end, 0.3);
    }
  }
  private buffer(id: CueId) {
    let b = this.buffers.get(id);
    if (!b) {
      const samples = buildSamples(RECIPES[id].params, this.ctx.sampleRate);
      b = this.ctx.createBuffer(1, Math.max(1, samples.length), this.ctx.sampleRate);
      b.getChannelData(0).set(samples);
      this.buffers.set(id, b);
    }
    return b;
  }
}
/** Two seconds of white noise from xorshift32, the same on every load. */
function noiseBuffer(ctx: BaseAudioContext) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
    data = b.getChannelData(0);
  let x = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    data[i] = (x >>> 0) / 0xffffffff - 0.5;
  }
  return b;
}
```

- [ ] **Step 4: Run** `npx vitest run src/audio` — Expected: PASS.

- [ ] **Step 5: Commit** `git add src/audio/instruments.ts src/audio/ambience.ts src/audio/engine.ts && git commit -m "Synthesized instruments, reverb and limiter in the engine"`

---

### Task 7: Conductor

**Files:** Create `src/audio/conductor.ts`; Test `src/audio/conductor.test.ts`

**Interfaces:**
- Consumes: `Activity`, `silent` (1), `shotsByFamily`, `Family` (1), `layersFor`, `Drum` (2), `extentFor`, `climb`, `Color` (harmony), `REGISTER`, `Instrument` (4), `colorOf`, `toneFor` (intensity), `Score`, `Note` (score), `schedule`, `Parts` (5), `STINGERS` (4), `TIMING`, `CueId` (3), `nextSlot`, `stepLength` (clock)
- Produces: `interface Voices { play(note: Note): boolean; instrument(name, hz, at, velocity, pan): boolean; duck(at): void; ambience: { chord(notes, at): void; tone(factor): void } }`, `interface Measure { threat; defense; clear; heavies; drums: boolean; playing: boolean }`, `class Conductor { readonly score: Score; readonly activity: Activity; get color(): Color; theme(drone, now); shots(events, content, now); measure(m: Measure); cue(id, now, voice?, gain?); play(cues, now); window(from, to) }`

- [ ] **Step 1: Write the failing test** `src/audio/conductor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, TowerId } from "../core/types";
import { stepLength } from "./clock";
import { Conductor, type Voices } from "./conductor";
import type { Instrument } from "./instruments";

const rapid = Object.values(DEFAULT_CONTENT.towers).find((d) => d.attack.kind === "direct" && !d.placement)!.id as TowerId;
const at = { x: 0, y: 0 };
class Recorder implements Voices {
  notes: { name: Instrument; at: number }[] = [];
  effects = 0;
  ducks = 0;
  ambience = { chord: () => {}, tone: () => {} };
  play() {
    this.effects++;
    return true;
  }
  instrument(name: Instrument, _hz: number, at: number) {
    this.notes.push({ name, at });
    return true;
  }
  duck() {
    this.ducks++;
  }
}
/** Drives a conductor through `bars` bars of rapid fire at `rate` shots per second, frame by frame like the game. */
function run(rate: number, bars: number) {
  const r = new Recorder(),
    c = new Conductor(r),
    frame = 1 / 30;
  c.theme("outpost", 0);
  const end = bars * stepLength(c.score.clock, 1);
  let owed = 0,
    first = -1;
  for (let t = 0; t < end; t += frame) {
    const events: GameEvent[] = [];
    for (owed += rate * frame; owed >= 1; owed--) events.push({ type: "shot", tower: rapid, from: at, to: at, color: 0 });
    if (events.length && first < 0) first = t;
    c.shots(events, DEFAULT_CONTENT, t);
    c.measure({ threat: 0, defense: 0, clear: 5, heavies: 0, drums: true, playing: true });
    c.window(t, t + frame);
  }
  return { r, first, beat: stepLength(c.score.clock, 4) };
}
const plucks = (r: Recorder) => r.notes.filter((n) => n.name === "pluck").length;

describe("Conductor", () => {
  it("keeps the note count set by the composition, however fast the towers fire", () => {
    const slow = plucks(run(1, 4).r),
      fast = plucks(run(80, 4).r);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThanOrEqual(4 * 8);
  });
  it("answers a family's first shot within a beat", () => {
    const { r, first, beat } = run(2, 2);
    expect(r.notes.find((n) => n.name === "pluck")!.at - first).toBeLessThanOrEqual(beat + 1e-6);
  });
  it("plays no drums at low threat", () => {
    expect(run(10, 2).r.notes.some((n) => ["kick", "snare", "hat"].includes(n.name))).toBe(false);
  });
  it("plays stingers on instruments and alerts as effects", () => {
    const r = new Recorder(),
      c = new Conductor(r);
    c.theme("outpost", 0);
    c.cue("won", 0.1);
    expect(r.notes.length).toBeGreaterThan(1);
    expect(r.ducks).toBe(1);
    expect(r.effects).toBe(0);
    c.cue("reject", 0.1);
    expect(r.effects).toBe(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/audio/conductor.test.ts` — Expected: FAIL, module missing.

- [ ] **Step 3: Create `src/audio/conductor.ts`**

```ts
import type { ContentPack, GameEvent } from "../core/types";
import { Activity, silent } from "./activity";
import { nextSlot, stepLength } from "./clock";
import type { Cue } from "./cues";
import { shotsByFamily, type Family } from "./families";
import { layersFor, type Drum } from "./grooves";
import { climb, extentFor, type Color } from "./harmony";
import { REGISTER, type Instrument } from "./instruments";
import { colorOf, toneFor } from "./intensity";
import type { DroneId } from "./mood";
import { TIMING, type CueId } from "./recipes";
import { Score, type Note } from "./score";
import { schedule, type Parts } from "./sequencer";
import { STINGERS } from "./stingers";
// Turns the game into music: towers raise their family's activity, enemies set the drums, defense the harmony, the
// clear time the mood. Driven alike by the game (`app/audio.ts`), the sound board and the offline renderer.

/** What the conductor needs from the audio engine; tests pass a recorder. */
export interface Voices {
  play(note: Note): boolean;
  instrument(name: Instrument, hz: number, at: number, velocity: number, pan: number): boolean;
  duck(at: number): void;
  ambience: { chord(notes: readonly number[], at: number): void; tone(factor: number): void };
}
export interface Measure {
  threat: number;
  defense: number;
  clear: number;
  heavies: number;
  /** A wave is running, so the enemies' drums may play. */
  drums: boolean;
  /** In the game view and not paused. */
  playing: boolean;
}
interface Player {
  instrument: Instrument;
  pan: number;
  gain: number;
}
/** Each family's instrument, place in the stereo field and level. */
const PLAYERS: Record<Family, Player> = {
  rapid: { instrument: "pluck", pan: -0.35, gain: 0.6 },
  heavy: { instrument: "bass", pan: 0, gain: 0.8 },
  electric: { instrument: "bell", pan: 0.4, gain: 0.45 },
  control: { instrument: "swell", pan: 0, gain: 0.6 },
  fire: { instrument: "shaker", pan: 0.25, gain: 0.5 },
  traps: { instrument: "click", pan: -0.2, gain: 0.5 },
};
const DRUMS: Record<Drum, Player> = {
  kick: { instrument: "kick", pan: 0, gain: 0.8 },
  snare: { instrument: "snare", pan: 0.05, gain: 0.6 },
  hat: { instrument: "hat", pan: 0.15, gain: 0.5 },
  stomp: { instrument: "tom", pan: 0, gain: 0.8 },
  bass: { instrument: "bass", pan: 0, gain: 0.6 },
};
const ARP: Player = { instrument: "bell", pan: -0.15, gain: 0.25 };
const SILENT = silent();

export class Conductor {
  readonly score = new Score();
  readonly activity = new Activity();
  private mood: Color = "drive";
  private parts: Parts = { drums: [], arp: false, extent: 3, color: "drive", activity: SILENT };
  constructor(private voices: Voices) {}
  get color() {
    return this.mood;
  }
  theme(drone: DroneId, now: number) {
    if (this.score.theme(drone, now)) this.voices.ambience.chord(this.score.chordAt(now), now);
  }
  shots(events: readonly GameEvent[], content: ContentPack, now: number) {
    this.activity.update(shotsByFamily(events, content), now);
  }
  measure(m: Measure) {
    this.mood = colorOf(m.clear, this.mood);
    this.score.extent = extentFor(m.defense);
    this.parts = {
      drums: m.playing && m.drums ? layersFor(m.threat, m.heavies) : [],
      arp: m.playing && m.defense >= 0.75,
      extent: this.score.extent,
      color: this.mood,
      activity: m.playing ? this.activity.levels : SILENT,
    };
    this.voices.ambience.tone(toneFor(this.mood, m.defense));
  }
  /** A cue: a stinger on instruments when it has one, else its effect. */
  cue(id: CueId, now: number, voice = 0, gain = 1) {
    const stinger = STINGERS[id];
    if (!stinger) {
      this.voices.play(this.score.place({ id, voice, gain }, now));
      return;
    }
    const at = nextSlot(this.score.clock, now, TIMING[id].grid),
      step = stepLength(this.score.clock, 16),
      chord = this.score.chordAt(at);
    for (const [name, tone, offset, velocity] of stinger.notes) this.voices.instrument(name, pitch(name, chord, tone), at + offset * step, velocity * Math.min(1, gain), 0);
    if (stinger.duck) this.voices.duck(at);
  }
  play(cues: readonly Cue[], now: number) {
    for (const c of cues) this.cue(c.id, now, c.voice, c.gain);
  }
  /** Sequencer window: pad chords, drums, the families' parts and the arpeggio due between `from` and `to`. */
  window(from: number, to: number) {
    for (const b of schedule(this.score.clock, this.score.music, this.parts, from, to)) {
      if (b.kind === "chord") this.voices.ambience.chord(b.notes, b.at);
      else if (b.kind === "part") this.note(PLAYERS[b.family], b.voice, b.velocity, b.at);
      else if (b.kind === "arp") this.note(ARP, b.voice, 1, b.at);
      else this.note(DRUMS[b.drum], 0, 1, b.at);
    }
  }
  private note(player: Player, tone: number, velocity: number, at: number) {
    this.voices.instrument(player.instrument, pitch(player.instrument, this.score.chordAt(at), tone), at, velocity * player.gain, player.pan);
  }
}
/** A pitched instrument's chord tone around its register; unpitched instruments ignore it. */
const pitch = (name: Instrument, chord: readonly number[], tone: number) => {
  const register = REGISTER[name];
  return register ? climb(register, chord, tone) : 0;
};
```

- [ ] **Step 4: Run** `npx vitest run src/audio` — Expected: PASS (4 Conductor tests among them).

- [ ] **Step 5: Commit** `git add src/audio/conductor.ts src/audio/conductor.test.ts && git commit -m "Add the conductor: towers, enemies and mood to music"`

---

### Task 8: Game adapter on the conductor

**Files:** Replace `src/app/audio.ts`

**Interfaces:**
- Consumes: `Conductor` (7), `AudioEngine` (6), `intensityOf`, `bossSpawned`, `cuesFor`, `ReactorWatch`, `newlyEliminated`, `moodOf`, `Sequencer`, settings, `unlockOnGesture`
- Produces: the same public `Audio` API

- [ ] **Step 1: Replace `src/app/audio.ts`**

```ts
import { Conductor } from "../audio/conductor";
import { cuesFor, newlyEliminated, ReactorWatch } from "../audio/cues";
import { AudioEngine } from "../audio/engine";
import { bossSpawned, intensityOf } from "../audio/intensity";
import { moodOf } from "../audio/mood";
import type { CueId } from "../audio/recipes";
import { Sequencer } from "../audio/sequencer";
import { loadSettings, saveSettings, type SoundSettings } from "../audio/settings";
import { unlockOnGesture } from "../audio/unlock";
import type { Game } from "../core/game";
import type { Match } from "../core/match";
import type { GameEvent } from "../core/types";
// Render-side sound: reads drained events and state once per frame, never changes them. The conductor turns them
// into music; the sequencer schedules it ahead on the audio clock.

/** Seconds of audio time between two measurements of threat, defense and clear time. */
const MEASURE = 0.5;
interface Sound {
  ctx: AudioContext;
  engine: AudioEngine;
  conductor: Conductor;
}
export class Audio {
  settings: SoundSettings = loadSettings();
  private sound: Sound | null = null;
  private listeners = new Set<() => void>();
  private reactor = new ReactorWatch();
  private eliminated: readonly (number | null)[] = [];
  private measured = -Infinity;
  get on() {
    return !this.settings.muted;
  }
  onChange(f: () => void) {
    this.listeners.add(f);
  }
  /** Creates or resumes the context; true once it runs. The first call must come from a user gesture. Throws without Web Audio. */
  async start() {
    if (!this.sound) {
      const ctx = new AudioContext(),
        engine = new AudioEngine(ctx),
        conductor = new Conductor(engine);
      this.sound = { ctx, engine, conductor };
      engine.volumes(this.settings);
      new Sequencer(() => ctx.currentTime, (from, to) => this.live()?.conductor.window(from, to)).start();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void ctx.suspend();
        else if (this.on) void ctx.resume();
      });
    }
    await this.sound.ctx.resume();
    return this.sound.ctx.state === "running";
  }
  /** A saved "on" waits for the visit's first gesture, because browsers keep a context silent until then. */
  armAutoStart() {
    // Turned off in the meantime: nothing to start, stop listening.
    if (this.on) unlockOnGesture(window, () => (this.on ? this.start() : Promise.resolve(true)));
  }
  /** Before the context runs, scheduled sounds would pile up at time 0 and all fire on resume. */
  private live() {
    return this.on && this.sound?.ctx.state === "running" ? this.sound : null;
  }
  async update(next: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...next };
    saveSettings(this.settings);
    for (const f of this.listeners) f();
    if (this.on) await this.start();
    this.sound?.engine.volumes(this.settings);
    if (!this.on) await this.sound?.ctx.suspend();
  }
  cue(id: CueId) {
    const s = this.live();
    s?.conductor.cue(id, s.ctx.currentTime);
  }
  frame(events: readonly GameEvent[], game: Game, match: Match | null) {
    const s = this.live();
    if (!s) return;
    const now = s.ctx.currentTime,
      view = document.documentElement.dataset.view === "menu" ? "menu" : "game",
      state = game.state,
      mood = moodOf({ view, theme: game.map.theme ?? "outpost", status: state.status, paused: state.paused, enemies: state.enemies.length });
    s.engine.ambience.set(mood);
    s.conductor.theme(mood.drone, now);
    s.conductor.shots(events, game.content, now);
    if (now >= this.measured + MEASURE) {
      this.measured = now;
      s.conductor.measure({ ...intensityOf(state, game.content, game.map.path.length), drums: state.status === "wave", playing: view === "game" && !state.paused });
    }
    s.conductor.play(cuesFor(events, game.content, view), now);
    if (bossSpawned(events, state, game.content)) this.cue("boss");
    if (this.reactor.crossed(state, game.mission.reactorEnergy)) this.cue("lowReactor");
    if (match && newlyEliminated(this.eliminated, match.eliminatedAt, match.fields.indexOf(game)).length) this.cue("eliminated");
    this.eliminated = match ? [...match.eliminatedAt] : [];
  }
}
```

- [ ] **Step 2: Run** `npm test` — Expected: PASS. `npx tsc --noEmit` fails only in `src/sound-board.ts`.

- [ ] **Step 3: Commit** `git add src/app/audio.ts && git commit -m "Drive the game's sound through the conductor"`

---

### Task 9: Sound board and offline renders

**Files:** Replace `src/sound-board.ts`; Create `src/audio/wav.ts`, `src/audio/wav.test.ts`, `src/music-render.ts`, `scripts/render-music.ts`; Modify `src/gallery.ts`

**Interfaces:**
- Produces: `encodeWav(channels, sampleRate): Uint8Array`, `levels(channels): { peak: number; rms: number }` (dBFS); `renderMusic(s: Scenario): Promise<{ wav: string; peak: number; rms: number }>` on `window.__renderMusic` under `/gallery.html?render`; the script writes `visual-check/music/*.wav` and `index.html`

- [ ] **Step 1: Write the failing test** `src/audio/wav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { encodeWav, levels } from "./wav";

describe("wav", () => {
  it("writes a 16-bit PCM header and clips samples", () => {
    const bytes = encodeWav([new Float32Array([0, 2]), new Float32Array([-2, 0.5])], 44100),
      view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(32767);
  });
  it("measures peak and RMS in dBFS", () => {
    const l = levels([new Float32Array([0.5, -0.5, 0.5, -0.5])]);
    expect(l.peak).toBeCloseTo(-6.02, 1);
    expect(l.rms).toBeCloseTo(-6.02, 1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/audio/wav.test.ts` — Expected: FAIL.

- [ ] **Step 3: Create `src/audio/wav.ts`**

```ts
// WAV encoding and level measurement for the offline music renders (scripts/render-music.ts).

/** 16-bit PCM WAV, channels interleaved, samples clipped to ±1. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number) {
  const n = channels[0].length,
    count = channels.length,
    size = 44 + n * count * 2,
    view = new DataView(new ArrayBuffer(size)),
    text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, size - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, n * count * 2, true);
  let offset = 44;
  for (let i = 0; i < n; i++)
    for (const ch of channels) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  return new Uint8Array(view.buffer);
}
/** Peak and RMS level over all channels, in dBFS. */
export function levels(channels: readonly Float32Array[]) {
  let peak = 0,
    sum = 0,
    n = 0;
  for (const ch of channels)
    for (const s of ch) {
      peak = Math.max(peak, Math.abs(s));
      sum += s * s;
      n++;
    }
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { peak: db(peak), rms: db(Math.sqrt(sum / Math.max(1, n))) };
}
```

- [ ] **Step 4: Run** the test — Expected: PASS.

- [ ] **Step 5: Create `src/music-render.ts`**

```ts
import { Conductor } from "./audio/conductor";
import { cuesFor } from "./audio/cues";
import { AudioEngine } from "./audio/engine";
import { familyOf, type Family } from "./audio/families";
import { MUSIC } from "./audio/harmony";
import type { DroneId } from "./audio/mood";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { encodeWav, levels } from "./audio/wav";
import { DEFAULT_CONTENT } from "./content";
import type { GameEvent, TowerId } from "./core/types";
// Dev-only (`/gallery.html?render`): renders a music scene offline through the real engine and conductor, for
// scripts/render-music.ts.

export interface Scenario {
  theme: DroneId;
  families: readonly Family[];
  rate: number;
  threat: number;
  defense: number;
  clear: number;
  heavies: number;
  bars: number;
}
const RATE = 44100,
  TAIL = 2,
  at = { x: 0, y: 0 };

export async function renderMusic(s: Scenario) {
  const seconds = (s.bars * 4 * 60) / MUSIC[s.theme].bpm,
    ctx = new OfflineAudioContext(2, Math.ceil((seconds + TAIL) * RATE), RATE),
    engine = new AudioEngine(ctx),
    conductor = new Conductor(engine),
    shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => {
      const f = familyOf(d);
      return f !== null && s.families.includes(f);
    });
  engine.volumes({ ...DEFAULT_SETTINGS, muted: false });
  engine.ambience.set({ drone: s.theme, level: 0.7 });
  conductor.theme(s.theme, 0);
  let owed = 0,
    next = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    const events: GameEvent[] = [];
    for (owed += s.rate / 30; owed >= 1; owed--, next++) {
      const d = shooters[next % shooters.length];
      events.push({ type: "shot", tower: d.id as TowerId, from: at, to: at, color: d.color });
      if (next % 5 === 0) events.push({ type: "kill", at, color: d.color, reward: 5 });
    }
    conductor.shots(events, DEFAULT_CONTENT, t);
    conductor.measure({ threat: s.threat, defense: s.defense, clear: s.clear, heavies: s.heavies, drums: true, playing: true });
    conductor.play(cuesFor(events, DEFAULT_CONTENT, "game"), t);
    conductor.window(t, t + 1 / 30);
  }
  const buffer = await ctx.startRendering(),
    channels = [buffer.getChannelData(0), buffer.getChannelData(1)],
    bytes = encodeWav(channels, RATE);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { wav: btoa(binary), ...levels(channels) };
}
```

- [ ] **Step 6: Edit `src/gallery.ts`** — add to the `query` constants:

```ts
  /** `?render`: offline music renders for scripts/render-music.ts (see `music-render.ts`); no canvas. */
  render = query.has("render"),
```

and change the sound branch to:

```ts
if (render)
  void import("./music-render").then((m) => {
    (window as unknown as { __renderMusic: typeof m.renderMusic }).__renderMusic = m.renderMusic;
  });
else if (sound) void import("./sound-board").then((m) => m.mountSoundBoard(document.getElementById("gallery")!));
else
```

- [ ] **Step 7: Create `scripts/render-music.ts`**

```ts
// Renders music scenes offline to WAV for listening (needs `npm run dev`):
//   npx vite-node scripts/render-music.ts [-- --theme outpost]
// Writes visual-check/music/*.wav and index.html (play them back to back) and prints peak/RMS per clip.
import { mkdirSync, writeFileSync } from "node:fs";
import type { Family } from "../src/audio/families";
import type { Scenario } from "../src/music-render";
import { launch } from "./browser";

const BASE = "http://localhost:4173",
  OUT = "visual-check/music",
  theme = (process.argv.includes("--theme") ? process.argv[process.argv.indexOf("--theme") + 1] : "outpost") as Scenario["theme"],
  ALL: Family[] = ["rapid", "heavy", "electric", "control", "fire", "traps"],
  base = { theme, threat: 0.6, defense: 0.5, clear: 6, heavies: 0, bars: 8 };
const SCENES: [string, Scenario][] = [
  ...[5, 10, 20, 40, 80].map((rate): [string, Scenario] => [`rapid-${rate}`, { ...base, families: ["rapid"], rate }]),
  ...[5, 10, 20, 40, 80].map((rate): [string, Scenario] => [`mixed-${rate}`, { ...base, families: ALL, rate }]),
  ["heavy-20", { ...base, families: ["heavy"], rate: 20 }],
  ["calm", { ...base, families: ["rapid", "control"], rate: 6, threat: 0.1, defense: 0.2, clear: 2 }],
  ["climax", { ...base, families: ALL, rate: 40, threat: 0.95, defense: 0.9, clear: 12, heavies: 2 }],
];

mkdirSync(OUT, { recursive: true });
const browser = await launch(BASE),
  page = await browser.newPage();
await page.goto(`${BASE}/gallery.html?render`);
await page.waitForFunction(() => "__renderMusic" in window);
const rows: string[] = [];
for (const [name, scene] of SCENES) {
  const r = await page.evaluate((s) => (window as unknown as { __renderMusic: (s: Scenario) => Promise<{ wav: string; peak: number; rms: number }> }).__renderMusic(s), scene);
  writeFileSync(`${OUT}/${theme}-${name}.wav`, Buffer.from(r.wav, "base64"));
  rows.push(`${name}\t${r.peak.toFixed(1)} dBFS peak\t${r.rms.toFixed(1)} dBFS RMS`);
  console.log(rows[rows.length - 1]);
}
writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Music renders</title><body style="font:14px system-ui;background:#111;color:#ddd">${SCENES.map(([name], i) => `<p>${rows[i]}<br><audio controls preload="none" src="${theme}-${name}.wav"></audio></p>`).join("")}`,
);
await browser.close();
```

- [ ] **Step 8: Replace `src/sound-board.ts`**

```ts
import { Conductor } from "./audio/conductor";
import { cuesFor } from "./audio/cues";
import { AudioEngine } from "./audio/engine";
import { FAMILIES, familyOf, type Family } from "./audio/families";
import { MUSIC } from "./audio/harmony";
import { INSTRUMENTS, REGISTER, type Instrument } from "./audio/instruments";
import type { DroneId } from "./audio/mood";
import { COMBAT_CUES, FLOW_CUES, RECIPES, TIMING, UI_CUES, type CueId } from "./audio/recipes";
import { Sequencer } from "./audio/sequencer";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { STINGERS } from "./audio/stingers";
import { DEFAULT_CONTENT } from "./content";
import type { GameEvent, TowerId } from "./core/types";
// Dev-only page (`/gallery.html?sound`): every effect and instrument, a live music test through the real conductor,
// and a review sheet copied out as a markdown table. Offline clips: scripts/render-music.ts.

const CRITERIA = [
  ["Clarity", "Can you tell what happened from the sound alone? 1 muddy, 5 instantly"],
  ["Fits the look", "Does it match the glowing sci-fi visuals? 1 out of place, 5 perfect"],
  ["Annoyance after 20×", "Click it about 20 times. 1 grating, 5 still pleasant"],
  ["Loudness vs. others", "1 badly too loud or quiet (say which in the notes), 5 balanced"],
  ["Feels in time", "During the music test: 1 off the beat, 5 locked to it"],
  ["Lag noticeable", "During the music test: 1 clearly late after the shot, 5 not noticeable"],
] as const;
const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const MIXES: Record<string, readonly Family[]> = { rapid: ["rapid"], heavy: ["heavy"], mixed: FAMILIES };
const at = { x: 0, y: 0 };
const timing = (id: CueId) => {
  const g = TIMING[id].grid;
  return `${g === 0 ? "instant" : g === 1 ? "bar" : g === 4 ? "beat" : `1/${g}`}${STINGERS[id] ? " · instruments" : TIMING[id].pitched ? " · pitched" : ""}`;
};
const slider = (id: string, label: string, max: number, value: number) => `<label>${label} <input id="${id}" type="range" min="0" max="${max}" value="${value}"><output id="${id}-out">${value}</output></label>`;

export function mountSoundBoard(root: HTMLElement) {
  let live: { ctx: AudioContext; engine: AudioEngine; conductor: Conductor } | null = null,
    timer: ReturnType<typeof setInterval> | null = null;
  const head = `<div class="sb-row sb-head"><span>Sound</span><span>Timing</span>${CRITERIA.map(([c, hint]) => `<span title="${hint}">${c}</span>`).join("")}<span>Notes</span></div>`,
    effects = [...COMBAT_CUES, ...FLOW_CUES, ...UI_CUES].map((id) => row(`cue:${id}`, id, timing(id), `cap ${RECIPES[id].cap} · gap ${RECIPES[id].gap}s`)).join(""),
    instruments = (Object.keys(INSTRUMENTS) as Instrument[]).map((name) => row(`instrument:${name}`, name, REGISTER[name] ? "pitched" : "unpitched", "")).join("");
  root.innerHTML = `<style>.sb{display:grid;gap:8px;max-width:1200px}.sb h2{margin:16px 0 4px}.sb-row{display:grid;grid-template-columns:8em 9em repeat(6,7.5em) 1fr;gap:6px;align-items:center}.sb-head span{font-size:11px;color:#8fa6b8}.sb-row small{color:#8fa6b8}.sb dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0}.sb dt{font-weight:600}.sb textarea{width:100%;height:12em}.sb fieldset{display:flex;flex-wrap:wrap;gap:12px;align-items:center}</style>
  <div class="sb"><p><button id="sb-start">Start audio</button> Rate each sound from 1 (bad) to 5 (good); leave a box empty if you have no opinion. Offline clips: <code>npx vite-node scripts/render-music.ts</code>.</p>
  <dl>${CRITERIA.map(([c, hint]) => `<dt>${c}</dt><dd>${hint}</dd>`).join("")}</dl>
  <fieldset><legend>Music test</legend><label>Theme <select id="sb-theme">${Object.keys(MUSIC).map((d) => `<option${d === "outpost" ? " selected" : ""}>${d}</option>`).join("")}</select></label>
  ${slider("sb-level", "Drone %", 100, 60)}<button id="sb-drone-off">Drone off</button><output id="sb-info"></output>
  <label>Towers <select id="sb-mix">${Object.keys(MIXES).map((m) => `<option>${m}</option>`).join("")}</select></label>
  ${slider("sb-rate", "Shots/s", 80, 10)} ${slider("sb-threat", "Threat %", 100, 40)} ${slider("sb-defense", "Defense %", 100, 30)} ${slider("sb-clear", "Clear time s", 20, 6)}
  <label><input id="sb-heavy" type="checkbox"> Heavy enemy</label><button id="sb-boss">Boss appears</button>
  <label><input type="radio" name="sb-speed" value="1" checked> 1×</label><label><input type="radio" name="sb-speed" value="2"> 2×</label>
  <button id="sb-play">Play 16 bars</button><button id="sb-stop">Stop</button><output id="sb-out"></output></fieldset>
  <h2>Effects and stingers</h2>${head}${effects}<h2>Instruments</h2>${head}${instruments}
  <p><button id="sb-copy">Copy results</button></p><textarea id="sb-copied" readonly></textarea></div>`;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const value = (id: string) => Number($<HTMLInputElement>(id).value);
  function ready() {
    if (!live) {
      const ctx = new AudioContext(),
        engine = new AudioEngine(ctx),
        conductor = new Conductor(engine);
      engine.volumes({ ...DEFAULT_SETTINGS, muted: false });
      live = { ctx, engine, conductor };
      new Sequencer(() => ctx.currentTime, (from, to) => conductor.window(from, to)).start();
      theme();
    }
    return live;
  }
  function theme() {
    const { ctx, engine, conductor } = ready(),
      drone = $<HTMLSelectElement>("sb-theme").value as DroneId;
    engine.ambience.set({ drone, level: value("sb-level") / 100 });
    conductor.theme(drone, ctx.currentTime);
  }
  /** The music's inputs from the sliders, as the game derives them from threat, defense and clear time. */
  function measure(playing: boolean) {
    ready().conductor.measure({ threat: value("sb-threat") / 100, defense: value("sb-defense") / 100, clear: value("sb-clear"), heavies: $<HTMLInputElement>("sb-heavy").checked ? 1 : 0, drums: true, playing });
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    measure(false);
  }
  function play() {
    const { ctx, conductor } = ready();
    stop();
    const families = MIXES[$<HTMLSelectElement>("sb-mix").value],
      shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => {
        const f = familyOf(d);
        return f !== null && families.includes(f);
      }),
      speed = Number(document.querySelector<HTMLInputElement>("[name=sb-speed]:checked")!.value),
      end = ctx.currentTime + (16 * 4 * 60) / conductor.score.clock.bpm;
    let owed = 0,
      next = 0;
    timer = setInterval(() => {
      const now = ctx.currentTime,
        events: GameEvent[] = [];
      for (owed += (value("sb-rate") * speed) / 30; owed >= 1; owed--, next++) {
        const d = shooters[next % shooters.length];
        events.push({ type: "shot", tower: d.id as TowerId, from: at, to: at, color: d.color });
        if (next % 5 === 0) events.push({ type: "kill", at, color: d.color, reward: 5 });
      }
      conductor.shots(events, DEFAULT_CONTENT, now);
      measure(true);
      conductor.play(cuesFor(events, DEFAULT_CONTENT, "game"), now);
      $("sb-out").textContent = FAMILIES.map((f) => `${f} ${conductor.activity.levels[f].toFixed(2)}`).join(" · ");
      if (now >= end) stop();
    }, 1000 / 30);
  }
  $("sb-start").onclick = () => void ready().ctx.resume();
  $("sb-theme").onchange = theme;
  $("sb-drone-off").onclick = () => ready().engine.ambience.stop();
  $("sb-play").onclick = play;
  $("sb-stop").onclick = stop;
  $("sb-heavy").onchange = () => measure(timer !== null);
  $("sb-boss").onclick = () => {
    const { ctx, conductor } = ready();
    conductor.cue("boss", ctx.currentTime);
  };
  for (const id of ["sb-level", "sb-rate", "sb-threat", "sb-defense", "sb-clear"])
    $<HTMLInputElement>(id).oninput = () => {
      $(`${id}-out`).textContent = String(value(id));
      if (id === "sb-level") theme();
      else measure(timer !== null);
    };
  root.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) => {
    b.onclick = () => {
      const { ctx, engine, conductor } = ready(),
        [kind, name] = b.dataset.play!.split(":");
      if (kind === "cue") conductor.cue(name as CueId, ctx.currentTime);
      else engine.instrument(name as Instrument, REGISTER[name as Instrument] ?? 0, ctx.currentTime, 0.8, 0);
    };
  });
  setInterval(() => {
    if (!live) return;
    const { score } = live.conductor,
      chord = score.chordAt(live.ctx.currentTime).map((n) => NOTES[n % 12]).join(" ");
    $("sb-info").textContent = `${score.clock.bpm} BPM · ${NOTES[score.music.root % 12]} ${score.music.mode} · ${live.conductor.color} · chord ${chord}`;
  }, 200);
  $("sb-copy").onclick = () => {
    const lines = [`| Sound | ${CRITERIA.map(([c]) => c).join(" | ")} | Notes |`, `| --- |${CRITERIA.map(() => " --- |").join("")} --- |`];
    root.querySelectorAll<HTMLElement>(".sb-row[data-id]").forEach((r) => {
      const scores = [...r.querySelectorAll<HTMLSelectElement>("select")].map((s) => s.value || "–");
      lines.push(`| ${r.dataset.id} | ${scores.join(" | ")} | ${r.querySelector<HTMLInputElement>("input")!.value} |`);
    });
    const out = $<HTMLTextAreaElement>("sb-copied");
    out.value = lines.join("\n");
    navigator.clipboard?.writeText(out.value).catch(() => out.select());
  };
}
function row(play: string, label: string, kind: string, hint: string) {
  const select = ([c]: readonly [string, string]) => `<select aria-label="${c} of ${label}"><option></option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select>`;
  return `<div class="sb-row" data-id="${play}"><button data-play="${play}">${label}</button><small title="${hint}">${kind}</small>${CRITERIA.map(select).join("")}<input placeholder="notes"></div>`;
}
```

- [ ] **Step 9: Run** `npx tsc --noEmit && npm test` — Expected: clean, all PASS. `wc -l src/sound-board.ts` < 500.

- [ ] **Step 10: Render** — with `npm run dev` running: `npx vite-node scripts/render-music.ts` — Expected: 13 WAVs and `index.html` in `visual-check/music/`, peak ≤ −0.5 dBFS (limiter), RMS printed, no exceptions. Ledger the level table.

- [ ] **Step 11: Commit** `git add src/sound-board.ts src/audio/wav.ts src/audio/wav.test.ts src/music-render.ts src/gallery.ts scripts/render-music.ts && git commit -m "Sound board on the conductor; offline music renders"`

---

### Task 10: Docs, game check, listening

**Files:** Modify `CLAUDE.md`, `README.md`

- [ ] **Step 1: In-game check** — run the existing music check (`.superpowers/sdd/<plan>/music-check.ts`, from the first music plan's Task 10; copy it from `/Volumes/T7 Shield/Temp/ion-bastion-sound/checks/music-check.ts` into the workspace) — Expected: no page errors; `starts` > 0. Ledger the numbers.

- [ ] **Step 2: CLAUDE.md** — Commands block: add `npx vite-node scripts/render-music.ts [-- --theme <id>]` with comment "with `npm run dev` running: 8-bar music clips per tower mix and fire rate (offline, `/gallery.html?render`) into visual-check/music/ with peak/RMS and an index.html". Sound section: replace the "Music:" bullet with: "Music: shots never play notes; they raise their tower family's activity (`families.ts`, `activity.ts`), which unlocks steps of the family's composed part (`parts.ts`) played on synthesized instruments (`instruments.ts`, reverb and limiter in `engine.ts`). Enemies set the drums (threat), defense the harmony and arpeggio, the clear time the mood; musical flow cues are instrument stingers (`stingers.ts`), the remaining effects ZzFX. `Conductor` (`conductor.ts`) ties it together and is driven by the game adapter, the sound board and the offline renderer alike; `sequencer.ts` schedules 100 ms ahead (\"A Tale of Two Clocks\"). A new attack kind needs a family in `families.ts`, a new theme an entry in `MUSIC` (`tsc` enforces both)." Layout row `src/audio/`: add `families`, `activity`, `parts`, `instruments`, `stingers`, `conductor`, `wav`.

- [ ] **Step 3: README.md** — replace the sentence starting "The sounds play as music:" with "The sounds play as music: every tower family is an instrument that plays its part while it fires, the enemies drive the drums, and a stronger defense makes the harmony richer."

- [ ] **Step 4: Full checks** — `npm test && npm run build` — Expected: PASS.

- [ ] **Step 5: Commit** `git add CLAUDE.md README.md && git commit -m "Document the instrument-track music"`

- [ ] **Step 6: Listening (the user)** — open `visual-check/music/index.html` (or the WAVs) and compare rapid/mixed at 5 → 80 shots/s, heavy, calm and climax; then fine-tune live on `/gallery.html?sound`. Save notes to `/Volumes/T7 Shield/Temp/ion-bastion-sound/review-music-2.md`.
