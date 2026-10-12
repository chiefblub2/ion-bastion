# Sound Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six sine blips with a synthesized sound design (combat, flow cues, UI sounds, ambient drone per map theme) with a saved mixer and a dev sound board for review.

**Architecture:** A new render-side folder `src/audio/`: pure modules (`zzfx`, `settings`, `recipes`, `cues`, `mixer`, `mood`, `drones`) carry all logic and are unit-tested; two Web Audio modules (`engine`, `ambience`) only play what the pure modules decide. `src/app/audio.ts` adapts drained `GameEvent`s and state into cues once per render frame. A popover mixer (`src/ui/sound-panel.ts`) and a delegated UI-sound listener (`src/audio/ui-sounds.ts`) sit on top; `/gallery.html?sound` is the review page.

**Tech Stack:** TypeScript strict ESM, Web Audio API, vendored ZzFX `buildSamples` (MIT), Vitest 3 (Node, no DOM).

**Spec:** `docs/superpowers/specs/2026-10-12-sound-design-design.md`

## Global Constraints

- Render side only: audio reads drained events, `CommandResult` and state; it never calls `Game.command`, never writes state, never touches `stateHash` or the network.
- No `AudioContext` and no DOM access at module import time (Vitest runs in Node); `zzfx` npm package is not imported.
- Files stay under 500 lines; everything is English (code, comments, UI text).
- Settings persist under localStorage key `ion-bastion:sound`; every storage access in try/catch, defaults when it fails.
- Default: sound off (`muted: true`) until the player turns it on.
- Mixing: global combat pool 24 voices, flow pool 8, ui pool 4; burst gain `min(1.5, 1 + 0.1·(n − 1))`; music duck to 40 % for 0.6 s; pitch unchanged at 2×.
- Before finishing: `npm test` and `npm run build` pass (the chunk-size warning is expected). No balance run (simulation untouched).
- Experiment and review notes go to `/Volumes/T7 Shield/Temp/ion-bastion-sound/`.

## Review Focus

1. **Blocked storage** (private mode, Node): settings load returns defaults instead of throwing → test in Task 2.
2. **Restart or mission change after reactor damage**: the new state's lives must not trigger the low-reactor cue → `ReactorWatch` test in Task 4.
3. **Versus, own field eliminated**: no "opponent eliminated" cue for yourself (the `lost` cue covers it) → `newlyEliminated` test in Task 4.
4. **Menu open while a multiplayer wave runs on**: combat cues silent, flow cues still play → `cuesFor(…, "menu")` test in Task 4.
5. **Saved "on" on a new visit**: the browser keeps the context silent until a gesture; the first pointer or key press must start it → manual check in Task 8 Step 6.

---

### Task 1: Vendored ZzFX sample generator

**Files:**
- Create: `src/audio/zzfx.ts`
- Test: `src/audio/zzfx.test.ts`

**Interfaces:**
- Produces: `type ZzfxParams = readonly (number | undefined)[]`, `buildSamples(params: ZzfxParams, sampleRate: number): Float32Array`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildSamples } from "./zzfx";

describe("buildSamples", () => {
  it("lasts attack + decay + sustain + release + delay", () => {
    expect(buildSamples([1, 0, 440, 0.1, 0.2, 0.3], 1000).length).toBe(600);
  });
  it("is deterministic and stays within its volume", () => {
    const params = [0.5, 0.05, 300, 0, 0.05, 0.2, 4, 1, 0, 0, 0, 0, 0, 0.5];
    const a = buildSamples(params, 8000);
    expect(buildSamples(params, 8000)).toEqual(a);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(0.5 + 1e-6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/audio/zzfx.test.ts`
Expected: FAIL, cannot resolve `./zzfx`.

- [ ] **Step 3: Implement**

Port of `ZZFX.buildSamples` from zzfx@1.4.0 `ZzFX.js` (lines 102–226). The only change: the frequency randomness term (`randomness*2*Math.random()`) is dropped; the engine applies it as playback-rate jitter.

```ts
/*
 * Sample generator ported from ZzFX by Frank Force (https://github.com/KilledByAPixel/ZzFX).
 * MIT License, Copyright (c) 2019 Frank Force
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Parameters in the order of the ZzFX designer (https://killedbyapixel.github.io/ZzFX): volume, randomness, frequency,
 * attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise,
 * modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter. Holes take the ZzFX defaults.
 */
export type ZzfxParams = readonly (number | undefined)[];
const DEFAULTS = [1, 0.05, 220, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];

/** One mono buffer; deterministic, because randomness (index 1) is applied at playback instead. */
export function buildSamples(params: ZzfxParams, sampleRate: number): Float32Array {
  let [volume, , frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter] =
    DEFAULTS.map((d, i) => params[i] ?? d);
  const PI2 = Math.PI * 2,
    sign = (v: number) => (v < 0 ? -1 : 1),
    startSlide = (slide *= (500 * PI2) / sampleRate / sampleRate);
  let startFrequency = (frequency *= PI2 / sampleRate),
    modOffset = 0,
    repeat = 0,
    crush = 0,
    jump = 1,
    t = 0,
    i = 0,
    s = 0,
    f = 0;
  // Biquad low-pass (negative filter) or high-pass (positive filter).
  const quality = 2,
    w = (PI2 * Math.abs(filter) * 2) / sampleRate,
    cos = Math.cos(w),
    alpha = Math.sin(w) / 2 / quality,
    a0 = 1 + alpha,
    a1 = (-2 * cos) / a0,
    a2 = (1 - alpha) / a0,
    b0 = (1 + sign(filter) * cos) / 2 / a0,
    b1 = -(sign(filter) + cos) / a0,
    b2 = b0;
  let x2 = 0,
    x1 = 0,
    y2 = 0,
    y1 = 0;
  attack = attack * sampleRate || 9; // a zero attack would pop
  decay *= sampleRate;
  sustain *= sampleRate;
  release *= sampleRate;
  delay *= sampleRate;
  deltaSlide *= (500 * PI2) / sampleRate ** 3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = (repeatTime * sampleRate) | 0;
  const length = (attack + decay + sustain + release + delay) | 0,
    b = new Float32Array(length > 0 ? length : 0);
  for (; i < length; b[i++] = s * volume) {
    if (!(++crush % ((bitCrush * 100) | 0))) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? shape > 4
                ? (t / PI2) % 1 < shapeCurve / 2 ? 1 : -1 // square with duty
                : Math.sin(t ** 3) // noise
              : Math.max(Math.min(Math.tan(t), 1), -1) // tan
            : 1 - ((((2 * t) / PI2) % 2) + 2) % 2 // saw
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2) // triangle
        : Math.sin(t);
      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        (shape > 4 ? s : sign(s) * Math.abs(s) ** shapeCurve) *
        (i < attack
          ? i / attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
              ? sustainVolume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume
                : 0);
      s = delay ? s / 2 + (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0]) / 2 / volume) : s;
      if (filter) s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
    }
    f = (frequency += slide += deltaSlide) * Math.cos(modulation * modOffset++);
    t += f + f * noise * (((i * i * PI2) % 2) - 1);
    if (jump && ++jump > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      jump = 0;
    }
    if (repeatTime && !(++repeat % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      jump ||= 1;
    }
  }
  return b;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/audio/zzfx.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/audio/zzfx.ts src/audio/zzfx.test.ts
git commit -m "Add vendored ZzFX sample generator"
```

---

### Task 2: Sound settings

**Files:**
- Create: `src/audio/settings.ts`
- Test: `src/audio/settings.test.ts`

**Interfaces:**
- Produces: `type Bus = "master" | "sfx" | "ui" | "music"`, `interface SoundSettings { muted: boolean; master: number; sfx: number; ui: number; music: number }`, `DEFAULT_SETTINGS`, `parseSettings(raw: string | null): SoundSettings`, `loadSettings(): SoundSettings`, `saveSettings(s: SoundSettings): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, parseSettings } from "./settings";

describe("sound settings", () => {
  it("falls back to the defaults for missing or broken data", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{nope")).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.muted).toBe(true);
  });
  it("keeps valid values and clamps volumes to 0–1", () => {
    const s = parseSettings(JSON.stringify({ muted: false, master: 2, sfx: -1, ui: 0.3, music: "loud" }));
    expect(s).toEqual({ muted: false, master: 1, sfx: 0, ui: 0.3, music: DEFAULT_SETTINGS.music });
  });
  it("loads the defaults when storage is unavailable", () => {
    // Node has no localStorage, like a browser that blocks site data.
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/audio/settings.test.ts` — Expected: FAIL, cannot resolve `./settings`.

- [ ] **Step 3: Implement**

```ts
// The mixer settings the browser keeps between visits, next to the last mission id (`app/progress.ts`).
const KEY = "ion-bastion:sound";
export type Bus = "master" | "sfx" | "ui" | "music";
export const BUSES = ["master", "sfx", "ui", "music"] as const satisfies readonly Bus[];
export interface SoundSettings {
  muted: boolean;
  master: number;
  sfx: number;
  ui: number;
  music: number;
}
export const DEFAULT_SETTINGS: Readonly<SoundSettings> = { muted: true, master: 0.8, sfx: 0.8, ui: 0.5, music: 0.5 };

export function parseSettings(raw: string | null): SoundSettings {
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  const o = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const s: SoundSettings = { ...DEFAULT_SETTINGS, muted: typeof o.muted === "boolean" ? o.muted : DEFAULT_SETTINGS.muted };
  for (const bus of BUSES) {
    const v = o[bus];
    if (typeof v === "number" && Number.isFinite(v)) s[bus] = Math.min(1, Math.max(0, v));
  }
  return s;
}
/** Storage can be missing or throw (private mode, blocked site data); then the defaults apply. */
export function loadSettings(): SoundSettings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s: SoundSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not remembered; the next visit starts with the defaults.
  }
}
```

- [ ] **Step 4: Run the test** — `npx vitest run src/audio/settings.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/audio/settings.ts src/audio/settings.test.ts
git commit -m "Add saved sound settings"
```

---

### Task 3: Cue recipes

**Files:**
- Create: `src/audio/recipes.ts`
- Test: `src/audio/recipes.test.ts`

**Interfaces:**
- Consumes: `ZzfxParams`, `buildSamples` (Task 1)
- Produces: `COMBAT_CUES`, `FLOW_CUES`, `UI_CUES`, `type CueId`, `type Pool = "combat" | "flow" | "ui"`, `interface CueSpec { params: ZzfxParams; pool: Pool; cap: number; gap: number; priority: number; duck?: boolean }`, `RECIPES: Record<CueId, CueSpec>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildSamples } from "./zzfx";
import { COMBAT_CUES, FLOW_CUES, RECIPES, UI_CUES } from "./recipes";

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
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/audio/recipes.test.ts` — Expected: FAIL, cannot resolve `./recipes`.

- [ ] **Step 3: Implement**

Starting values for a soft sci-fi palette (sine/triangle bodies, low-pass filters, short tails). They are tuned by ear in Task 10; paste new arrays from the ZzFX designer.

```ts
import type { ZzfxParams } from "./zzfx";
// One ZzFX recipe per cue. Tune them in the ZzFX designer (https://killedbyapixel.github.io/ZzFX) and on /gallery.html?sound.

export const COMBAT_CUES = ["bolt", "lob", "blast", "crackle", "beam", "swell", "chime", "hiss", "zap", "sweep", "crack", "trap", "impact", "kill", "evade", "overload", "income", "repair"] as const;
export const FLOW_CUES = ["build", "sell", "upgrade", "leak", "waveStart", "waveEnd", "won", "lost", "lowReactor", "reject", "incoming", "eliminated"] as const;
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
  bolt: combat([0.4, 0.05, 880, 0, 0.01, 0.06, 0, 1.5, -20, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02, 0, -3000], 4, 0.04),
  lob: combat([0.3, 0.05, 180, 0, 0.02, 0.1, 1, 1, -4, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.7, 0.03, 0, -1200], 3, 0.06),
  blast: combat([0.6, 0.05, 70, 0, 0.05, 0.35, 4, 2, -2, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.5, 0.05, 0, -900], 3, 0.07, 2),
  crackle: combat([0.35, 0.1, 1200, 0, 0.02, 0.08, 3, 1, 0, 0, 0, 0, 0.02, 0.8, 0, 0.1, 0, 0.6, 0, 0.4, 2000], 3, 0.06),
  beam: combat([0.3, 0, 520, 0.01, 0.12, 0.1, 2, 1, 0, 0, 0, 0, 0, 0, 30, 0, 0, 0.5, 0.02, 0, -2500], 2, 0.1),
  swell: combat([0.5, 0.05, 55, 0.03, 0.15, 0.4, 0, 1, -1, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.8, 0.1, 0, -500], 2, 0.15, 2),
  chime: combat([0.3, 0.02, 1568, 0, 0.05, 0.3, 0, 1, 0, 0, 523, 0.04, 0, 0, 0, 0, 0.08, 0.4, 0.02, 0, 0], 2, 0.1),
  hiss: combat([0.25, 0.1, 300, 0.02, 0.08, 0.15, 4, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 3000], 2, 0.08),
  zap: combat([0.3, 0.05, 1400, 0, 0.02, 0.07, 5, 0.4, -60, 0, 0, 0, 0, 0, 0, 0.05, 0, 0.6, 0, 0, -4000], 3, 0.06),
  sweep: combat([0.35, 0, 700, 0.01, 0.1, 0.2, 0, 1, -25, -2, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -2000], 2, 0.12),
  crack: combat([0.5, 0.02, 180, 0, 0, 0.12, 4, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0.01, 0, -6000], 2, 0.08, 2),
  trap: combat([0.35, 0.03, 240, 0, 0.01, 0.08, 1, 1, 0, 0, -80, 0.02, 0, 0, 0, 0, 0, 0.8, 0, 0, -2000], 3, 0.05),
  impact: combat([0.2, 0.1, 400, 0, 0, 0.05, 4, 1, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 0.01, 0, -2500], 4, 0.03, 0),
  kill: combat([0.3, 0.05, 1320, 0, 0.02, 0.12, 0, 1, 0, 0, 660, 0.03, 0, 0, 0, 0, 0.05, 0.5, 0, 0, -6000], 3, 0.05, 2),
  evade: combat([0.2, 0.05, 900, 0.01, 0, 0.08, 4, 1, 30, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 2500], 2, 0.1, 0),
  overload: combat([0.4, 0, 440, 0, 0.1, 0.4, 2, 1, -8, 0, 0, 0, 0, 0, 0, 0.1, 0, 0.6, 0.05, 0, -1500], 1, 0.3, 3),
  income: combat([0.15, 0.05, 1760, 0, 0.01, 0.06, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], 2, 0.08, 0),
  repair: combat([0.2, 0, 660, 0.02, 0.05, 0.15, 1, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -3000], 1, 0.2, 0),
  build: flow([0.35, 0, 523, 0, 0.03, 0.12, 1, 1, 0, 0, 262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  sell: flow([0.3, 0, 784, 0, 0.03, 0.12, 1, 1, 0, 0, -262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  upgrade: flow([0.35, 0, 523, 0, 0.06, 0.2, 0, 1, 0, 0, 262, 0.05, 0.1, 0, 0, 0, 0, 0.7, 0.01, 0, -4000], 2),
  leak: flow([0.6, 0, 80, 0, 0.08, 0.4, 1, 1, -3, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.8, 0.05, 0.3, -800], 3, true),
  waveStart: flow([0.45, 0, 220, 0.05, 0.3, 0.5, 2, 1, 0, 0, 110, 0.2, 0, 0, 0, 0, 0.12, 0.6, 0.1, 0.2, -1800], 3),
  waveEnd: flow([0.4, 0, 659, 0.02, 0.2, 0.5, 0, 1, 0, 0, -165, 0.15, 0, 0, 0, 0, 0.1, 0.6, 0.05, 0, -4000], 3),
  won: flow([0.5, 0, 523, 0.02, 0.5, 0.8, 0, 1, 0, 0, 262, 0.12, 0.25, 0, 0, 0, 0.15, 0.7, 0.1, 0, -5000], 4, true),
  lost: flow([0.5, 0, 330, 0.02, 0.5, 1, 2, 1, -1, 0, -55, 0.25, 0, 0, 0, 0, 0.2, 0.6, 0.1, 0.2, -1500], 4, true),
  lowReactor: flow([0.45, 0, 880, 0, 0.08, 0.08, 5, 0.5, 0, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.8, 0, 0, -3000], 4, true),
  reject: flow([0.3, 0, 160, 0, 0.04, 0.08, 1, 1, 0, 0, -40, 0.03, 0, 0, 0, 0, 0, 0.8, 0, 0, -1500], 1),
  incoming: flow([0.45, 0, 440, 0.01, 0.15, 0.2, 5, 0.5, 0, 0, 110, 0.08, 0.12, 0, 0, 0, 0, 0.7, 0, 0, -2500], 3),
  eliminated: flow([0.45, 0, 392, 0.02, 0.3, 0.6, 2, 1, -2, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.6, 0.05, 0, -1500], 3),
  click: ui([0.2, 0, 1200, 0, 0, 0.025, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -5000], 0.03),
  hover: ui([0.06, 0, 2400, 0, 0, 0.015, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 0.05),
};
```

- [ ] **Step 4: Run the test** — `npx vitest run src/audio/recipes.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/recipes.ts src/audio/recipes.test.ts
git commit -m "Add sound cue recipes"
```

---

### Task 4: Event → cue mapping

**Files:**
- Create: `src/audio/cues.ts`
- Test: `src/audio/cues.test.ts`

**Interfaces:**
- Consumes: `CueId`, `RECIPES` (Task 3); `fnv` from `src/core/hash.ts`; `AttackSpec`, `ContentPack`, `GameEvent`, `GameState` from `src/core/types.ts`
- Produces: `interface Cue { id: CueId; pitch: number; gain: number }`, `type View = "menu" | "game"`, `cuesFor(events: readonly GameEvent[], content: ContentPack, view: View): Cue[]`, `towerPitch(tower: string): number`, `burstGain(n: number): number`, `class ReactorWatch { crossed(state: GameState, max: number): boolean }`, `newlyEliminated(before: readonly (number | null)[], after: readonly (number | null)[], local: number): number[]`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, GameState, TowerId } from "../core/types";
import { burstGain, cuesFor, newlyEliminated, ReactorWatch, towerPitch } from "./cues";

const towers = Object.values(DEFAULT_CONTENT.towers);
const idOf = (pick: (d: (typeof towers)[number]) => boolean) => towers.find(pick)!.id as TowerId;
const direct = idOf((d) => d.attack.kind === "direct" && !d.placement),
  splash = idOf((d) => d.attack.kind === "splash" && !d.placement),
  trap = idOf((d) => d.placement === "path");
const at = { x: 0, y: 0 };
const shot = (tower: TowerId): GameEvent => ({ type: "shot", tower, from: at, to: at, color: 0 });

describe("cuesFor", () => {
  it("maps a shot to its attack kind's cue at the tower's pitch", () => {
    expect(cuesFor([shot(direct)], DEFAULT_CONTENT, "game")).toEqual([{ id: "bolt", pitch: towerPitch(direct), gain: 1 }]);
    expect(cuesFor([shot(trap)], DEFAULT_CONTENT, "game")[0].id).toBe("trap");
    expect(cuesFor([{ type: "impact", tower: splash, at, color: 0 }], DEFAULT_CONTENT, "game")[0].id).toBe("blast");
  });
  it("merges a burst into one louder cue", () => {
    expect(cuesFor([shot(direct), shot(direct), shot(direct)], DEFAULT_CONTENT, "game")).toEqual([{ id: "bolt", pitch: towerPitch(direct), gain: burstGain(3) }]);
    expect(burstGain(1)).toBe(1);
    expect(burstGain(50)).toBe(1.5);
  });
  it("stays silent for events that only accompany others", () => {
    expect(cuesFor([{ type: "damage", at, amount: 3, enemy: 1 }, { type: "spawn", at, enemy: 2 }], DEFAULT_CONTENT, "game")).toEqual([]);
  });
  it("keeps only flow cues while the menu is open", () => {
    const events: GameEvent[] = [shot(direct), { type: "leak", at, amount: 1 }, { type: "end", result: "lost" }];
    expect(cuesFor(events, DEFAULT_CONTENT, "menu").map((c) => c.id)).toEqual(["leak", "lost"]);
  });
});

describe("ReactorWatch", () => {
  const state = (lives: number) => ({ lives }) as GameState;
  it("fires once when the reactor falls to 30 % and never on a new state", () => {
    const w = new ReactorWatch(), s = state(20);
    expect(w.crossed(s, 20)).toBe(false);
    s.lives = 6;
    expect(w.crossed(s, 20)).toBe(true);
    s.lives = 5;
    expect(w.crossed(s, 20)).toBe(false);
    expect(w.crossed(state(3), 20)).toBe(false); // restart or mission change
  });
});

describe("newlyEliminated", () => {
  it("reports opponents who just dropped out, never the local seat", () => {
    expect(newlyEliminated([null, null, null], [120, null, 120], 0)).toEqual([2]);
    expect(newlyEliminated([], [null, null], 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/audio/cues.test.ts` — Expected: FAIL, cannot resolve `./cues`.

- [ ] **Step 3: Implement**

```ts
import { fnv } from "../core/hash";
import type { AttackSpec, ContentPack, GameEvent, GameState } from "../core/types";
import { RECIPES, type CueId } from "./recipes";
// Drained game events → sound cues. Every firing emits a `shot` with its tower id; chain, beam and pulse events only
// accompany it and stay silent.

export interface Cue {
  id: CueId;
  /** Playback rate before jitter. */
  pitch: number;
  gain: number;
}
export type View = "menu" | "game";
/** Support kinds never fire, so they have no cue. */
const FIRE: Record<AttackSpec["kind"], CueId | null> = {
  direct: "bolt", pierce: "beam", volley: "bolt", splash: "lob", mortar: "lob", chain: "crackle", focus: "beam", quake: "swell",
  slow: "chime", net: "chime", burn: "hiss", corrode: "hiss", decay: "hiss", stun: "zap", disrupt: "zap", pull: "sweep",
  execute: "crack", bleed: "trap", charge: "trap", pit: "trap", alarm: "trap",
  aura: null, income: null, detect: null, bounty: null, repair: null, mark: null,
};
const BLASTS = new Set<AttackSpec["kind"]>(["splash", "mortar", "charge"]);
const PLAIN: Partial<Record<GameEvent["type"], CueId>> = {
  kill: "kill", evade: "evade", overload: "overload", leak: "leak", build: "build", sell: "sell", upgrade: "upgrade",
  income: "income", repair: "repair", waveStart: "waveStart", waveEnd: "waveEnd",
};
/** A stable pitch per tower id, so towers of one attack kind still sound apart (0.88–1.12). */
export const towerPitch = (tower: string) => 0.88 + (fnv(tower) % 25) / 100;
export const burstGain = (n: number) => Math.min(1.5, 1 + 0.1 * (n - 1));

function cueOf(e: GameEvent, content: ContentPack): { id: CueId; pitch: number } | null {
  switch (e.type) {
    case "shot": {
      const d = content.towers[e.tower];
      const id = d.placement === "path" ? "trap" : FIRE[d.attack.kind];
      return id && { id, pitch: towerPitch(e.tower) };
    }
    case "impact":
      return { id: BLASTS.has(content.towers[e.tower].attack.kind) ? "blast" : "impact", pitch: towerPitch(e.tower) };
    case "end":
      return { id: e.result, pitch: 1 };
    default: {
      const id = PLAIN[e.type];
      return id ? { id, pitch: 1 } : null;
    }
  }
}
/** One cue per sound and pitch in this frame; in the menu only flow cues (a multiplayer wave runs on). */
export function cuesFor(events: readonly GameEvent[], content: ContentPack, view: View): Cue[] {
  const merged = new Map<string, { id: CueId; pitch: number; n: number }>();
  for (const e of events) {
    const c = cueOf(e, content);
    if (!c || (view === "menu" && RECIPES[c.id].pool === "combat")) continue;
    const key = `${c.id}@${c.pitch}`,
      m = merged.get(key);
    if (m) m.n++;
    else merged.set(key, { ...c, n: 1 });
  }
  return [...merged.values()].map(({ id, pitch, n }) => ({ id, pitch, gain: burstGain(n) }));
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

- [ ] **Step 4: Run** — `npx vitest run src/audio/cues.test.ts` — Expected: PASS (6 tests). If `tsc` later reports a missing or extra key in `FIRE`, align it with `AttackSpec["kind"]` in `src/core/types.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/cues.ts src/audio/cues.test.ts
git commit -m "Map game events to sound cues"
```

---

### Task 5: Voice mixer

**Files:**
- Create: `src/audio/mixer.ts`
- Test: `src/audio/mixer.test.ts`

**Interfaces:**
- Consumes: `CueId`, `CueSpec`, `Pool` (Task 3)
- Produces: `interface Voice { cue: CueId; pool: Pool; priority: number; start: number; end: number }`, `POOL_CAP: Record<Pool, number>`, `admit<V extends Voice>(id: CueId, spec: Pick<CueSpec, "pool" | "cap" | "gap" | "priority">, voices: readonly V[], lastStart: number | undefined, now: number): { play: false } | { play: true; steal?: V }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { admit, POOL_CAP, type Voice } from "./mixer";

const spec = { pool: "combat", cap: 2, gap: 0.05, priority: 1 } as const;
const voice = (cue: Voice["cue"], priority = 1, start = 0, end = 10): Voice => ({ cue, pool: "combat", priority, start, end });

describe("admit", () => {
  it("respects the gap and the per-cue cap", () => {
    expect(admit("bolt", spec, [], 0.98, 1)).toEqual({ play: false });
    expect(admit("bolt", spec, [voice("bolt"), voice("bolt")], undefined, 1)).toEqual({ play: false });
    expect(admit("bolt", spec, [voice("bolt"), voice("bolt", 1, 0, 0.5)], undefined, 1)).toEqual({ play: true });
  });
  it("steals the oldest lowest-priority voice from a full pool, never an equal one", () => {
    const full = Array.from({ length: POOL_CAP.combat }, (_, i) => voice("impact", 0, i));
    expect(admit("kill", { ...spec, priority: 2 }, full, undefined, 30)).toEqual({ play: true }); // all ended at 10, so the pool is free
    const alive = full.map((v) => ({ ...v, end: 99 }));
    expect(admit("kill", { ...spec, priority: 2 }, alive, undefined, 30)).toEqual({ play: true, steal: alive[0] });
    expect(admit("impact", { ...spec, priority: 0, cap: 99 }, alive, undefined, 30)).toEqual({ play: false });
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/audio/mixer.test.ts` — Expected: FAIL, cannot resolve `./mixer`.

- [ ] **Step 3: Implement**

```ts
import type { CueId, CueSpec, Pool } from "./recipes";
// Which cue may start now. Caps are in real seconds, so a 2× wave stays as dense as a 1× one.

export interface Voice {
  cue: CueId;
  pool: Pool;
  priority: number;
  start: number;
  end: number;
}
export const POOL_CAP: Record<Pool, number> = { combat: 24, flow: 8, ui: 4 };

export function admit<V extends Voice>(
  id: CueId,
  spec: Pick<CueSpec, "pool" | "cap" | "gap" | "priority">,
  voices: readonly V[],
  lastStart: number | undefined,
  now: number,
): { play: false } | { play: true; steal?: V } {
  if (lastStart !== undefined && now - lastStart < spec.gap) return { play: false };
  const alive = voices.filter((v) => v.end > now);
  if (alive.filter((v) => v.cue === id).length >= spec.cap) return { play: false };
  const pool = alive.filter((v) => v.pool === spec.pool);
  if (pool.length < POOL_CAP[spec.pool]) return { play: true };
  const steal = pool.filter((v) => v.priority < spec.priority).sort((a, b) => a.priority - b.priority || a.start - b.start)[0];
  return steal ? { play: true, steal } : { play: false };
}
```

- [ ] **Step 4: Run** — `npx vitest run src/audio/mixer.test.ts` — Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/audio/mixer.ts src/audio/mixer.test.ts
git commit -m "Add voice admission for the sound mixer"
```

---

### Task 6: Mood and drone table

**Files:**
- Create: `src/audio/mood.ts`, `src/audio/drones.ts`
- Test: `src/audio/mood.test.ts`

**Interfaces:**
- Consumes: `GameStatus`, `MapTheme` from `src/core/types.ts`; `View` (Task 4)
- Produces: `type DroneId = MapTheme | "menu"`, `interface Mood { drone: DroneId; level: number }`, `moodOf(m: { view: View; theme: MapTheme; status: GameStatus; paused: boolean; enemies: number }): Mood`, `interface DroneSpec { root: number; intervals: readonly number[]; wave: OscillatorType; cutoff: number; noise: number; lfo: number; detune: number }`, `DRONES: Record<DroneId, DroneSpec>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { DRONES } from "./drones";
import { moodOf } from "./mood";

const game = { view: "game", theme: "frost", status: "wave", paused: false, enemies: 0 } as const;
describe("moodOf", () => {
  it("plays the menu bed in the menu and a quiet bed while paused", () => {
    expect(moodOf({ ...game, view: "menu" })).toEqual({ drone: "menu", level: 0.6 });
    expect(moodOf({ ...game, paused: true })).toEqual({ drone: "frost", level: 0.25 });
    expect(moodOf({ ...game, status: "ready" })).toEqual({ drone: "frost", level: 0.5 });
  });
  it("swells with the number of enemies, up to full", () => {
    expect(moodOf({ ...game, enemies: 15 }).level).toBeCloseTo(0.85);
    expect(moodOf({ ...game, enemies: 300 }).level).toBe(1);
  });
});
describe("DRONES", () => {
  it("keep every drone low, filtered and quiet", () => {
    for (const [id, d] of Object.entries(DRONES)) {
      expect(d.root, id).toBeGreaterThan(30);
      expect(d.root, id).toBeLessThan(120);
      expect(d.cutoff, id).toBeGreaterThan(d.root * 2);
      expect(d.noise, id).toBeLessThanOrEqual(0.2);
    }
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/audio/mood.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/audio/mood.ts`**

```ts
import type { GameStatus, MapTheme } from "../core/types";
import type { View } from "./cues";

export type DroneId = MapTheme | "menu";
export interface Mood {
  drone: DroneId;
  /** Ambience gain, 0–1. */
  level: number;
}
/** Menu bed, a quiet bed while paused, and a swell with the enemies on the field during a wave. */
export function moodOf(m: { view: View; theme: MapTheme; status: GameStatus; paused: boolean; enemies: number }): Mood {
  if (m.view === "menu") return { drone: "menu", level: 0.6 };
  if (m.paused) return { drone: m.theme, level: 0.25 };
  if (m.status === "wave") return { drone: m.theme, level: 0.7 + 0.3 * Math.min(1, m.enemies / 30) };
  return { drone: m.theme, level: 0.5 };
}
```

- [ ] **Step 4: Implement `src/audio/drones.ts`**

```ts
import type { DroneId } from "./mood";
// The ambient drone per map theme: a few detuned oscillators through a breathing low-pass, plus filtered noise.

export interface DroneSpec {
  /** Hz. */
  root: number;
  /** Semitones above the root. */
  intervals: readonly number[];
  wave: OscillatorType;
  /** Low-pass centre in Hz; an LFO moves it by ±35 %. */
  cutoff: number;
  /** Gain of the band-passed noise layer. */
  noise: number;
  /** LFO rate in Hz. */
  lfo: number;
  /** Cents between the two oscillators of an interval. */
  detune: number;
}
const d = (root: number, intervals: number[], wave: OscillatorType, cutoff: number, noise: number, lfo: number, detune = 6): DroneSpec => ({ root, intervals, wave, cutoff, noise, lfo, detune });

export const DRONES: Record<DroneId, DroneSpec> = {
  menu: d(55, [0, 7, 12, 19], "sine", 900, 0.03, 0.04),
  outpost: d(55, [0, 7, 12], "triangle", 600, 0.05, 0.05),
  lock: d(58.27, [0, 7, 10], "sawtooth", 500, 0.04, 0.07),
  shard: d(61.74, [0, 5, 12, 19], "sine", 1400, 0.03, 0.09),
  ember: d(49, [0, 7, 12], "sawtooth", 450, 0.12, 0.06),
  core: d(55, [0, 12, 19], "triangle", 700, 0.05, 0.1),
  frost: d(65.41, [0, 7, 14, 19], "sine", 1800, 0.08, 0.04),
  toxic: d(51.91, [0, 6, 12], "sawtooth", 520, 0.06, 0.11),
  orbit: d(73.42, [0, 7, 12, 16], "sine", 1200, 0.02, 0.03),
  ruin: d(46.25, [0, 3, 7], "triangle", 400, 0.07, 0.05),
  rift: d(41.2, [0, 1, 7], "sawtooth", 380, 0.05, 0.13),
  dune: d(55, [0, 5, 7], "triangle", 650, 0.1, 0.04),
  abyss: d(36.71, [0, 7, 12], "sine", 300, 0.06, 0.03),
  storm: d(49, [0, 7, 10, 14], "sawtooth", 700, 0.15, 0.12),
  jungle: d(61.74, [0, 4, 7, 11], "triangle", 900, 0.09, 0.06),
  volcano: d(43.65, [0, 7, 12], "sawtooth", 420, 0.14, 0.08),
  geode: d(69.3, [0, 7, 12, 17], "sine", 1600, 0.03, 0.07),
  gear: d(58.27, [0, 7, 12], "square", 500, 0.05, 0.15),
  tide: d(51.91, [0, 5, 9, 12], "sine", 800, 0.12, 0.05),
};
```

`Record<DroneId, …>` makes `tsc` fail when a new `MapTheme` gets no drone.

- [ ] **Step 5: Run** — `npx vitest run src/audio/mood.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/audio/mood.ts src/audio/drones.ts src/audio/mood.test.ts
git commit -m "Add ambience mood and theme drones"
```

---

### Task 7: Web Audio engine and ambience

**Files:**
- Create: `src/audio/engine.ts`, `src/audio/ambience.ts`

**Interfaces:**
- Consumes: `buildSamples` (1), `SoundSettings` (2), `RECIPES`, `CueId` (3), `Cue` (4), `admit`, `Voice` (5), `Mood`, `DroneId` (6), `DRONES` (6)
- Produces: `class AudioEngine { readonly ctx: AudioContext; readonly ambience: Ambience; constructor(ctx: AudioContext); volumes(s: SoundSettings): void; play(cue: Cue): boolean }`, `class Ambience { set(mood: Mood): void; stop(): void }`

No unit tests (Node has no Web Audio); verified by `npm run build` here and by ear in Task 10.

- [ ] **Step 1: Write `src/audio/ambience.ts`**

```ts
import { DRONES } from "./drones";
import type { DroneId, Mood } from "./mood";
// Plays one drone at a time; a theme change crossfades, a level change glides.

const FADE = 3,
  GLIDE = 1.5;
interface Layer {
  id: DroneId;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  level: number;
}
export class Ambience {
  private layer: Layer | null = null;
  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    private noise: AudioBuffer,
  ) {}
  set(mood: Mood) {
    const now = this.ctx.currentTime;
    if (this.layer?.id !== mood.drone) {
      if (this.layer) this.fadeOut(this.layer, now);
      this.layer = this.build(mood.drone, now);
    }
    const layer = this.layer;
    if (Math.abs(layer.level - mood.level) < 0.01) return;
    const g = layer.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(mood.level, now, (layer.level < 0 ? FADE : GLIDE) / 3);
    layer.level = mood.level;
  }
  stop() {
    if (this.layer) this.fadeOut(this.layer, this.ctx.currentTime);
    this.layer = null;
  }
  private fadeOut(layer: Layer, now: number) {
    const g = layer.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(0, now, FADE / 3);
    for (const s of layer.sources) s.stop(now + FADE * 2);
  }
  private build(id: DroneId, now: number): Layer {
    const spec = DRONES[id],
      ctx = this.ctx,
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      lfo = ctx.createOscillator(),
      depth = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.connect(this.out);
    filter.type = "lowpass";
    filter.frequency.value = spec.cutoff;
    filter.Q.value = 0.7;
    filter.connect(gain);
    lfo.frequency.value = spec.lfo;
    depth.gain.value = spec.cutoff * 0.35;
    lfo.connect(depth).connect(filter.frequency);
    const sources: AudioScheduledSourceNode[] = [lfo],
      each = 0.12 / spec.intervals.length;
    for (const semitones of spec.intervals)
      for (const cents of [-spec.detune, spec.detune]) {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = spec.wave;
        o.frequency.value = spec.root * 2 ** (semitones / 12);
        o.detune.value = cents;
        g.gain.value = each;
        o.connect(g).connect(filter);
        sources.push(o);
      }
    if (spec.noise > 0) {
      const src = ctx.createBufferSource(),
        band = ctx.createBiquadFilter(),
        g = ctx.createGain();
      src.buffer = this.noise;
      src.loop = true;
      band.type = "bandpass";
      band.frequency.value = spec.cutoff * 2;
      band.Q.value = 0.8;
      g.gain.value = spec.noise;
      src.connect(band).connect(g).connect(gain);
      sources.push(src);
    }
    for (const s of sources) s.start(now);
    return { id, gain, sources, level: -1 };
  }
}
```

- [ ] **Step 2: Write `src/audio/engine.ts`**

```ts
import { Ambience } from "./ambience";
import type { Cue } from "./cues";
import { admit, type Voice } from "./mixer";
import { RECIPES, type CueId } from "./recipes";
import type { SoundSettings } from "./settings";
import { buildSamples } from "./zzfx";
// Buses: sfx and ui → master; music → duck → master; master → compressor → speakers.

/** Bus gain scale, so full sliders leave headroom for bursts. */
const HEADROOM = 0.5,
  DUCK_LEVEL = 0.4,
  DUCK_TIME = 0.6;
const BUS_OF = { combat: "sfx", flow: "sfx", ui: "ui" } as const;
type Playing = Voice & { source: AudioBufferSourceNode };

export class AudioEngine {
  readonly ambience: Ambience;
  private master: GainNode;
  private bus: Record<"sfx" | "ui" | "music", GainNode>;
  private duckGain: GainNode;
  private buffers = new Map<CueId, AudioBuffer>();
  private voices: Playing[] = [];
  private last = new Map<CueId, number>();
  constructor(readonly ctx: AudioContext) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(compressor);
    this.bus = { sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
    this.bus.sfx.connect(this.master);
    this.bus.ui.connect(this.master);
    this.duckGain = ctx.createGain();
    this.bus.music.connect(this.duckGain).connect(this.master);
    this.ambience = new Ambience(ctx, this.bus.music, noiseBuffer(ctx));
  }
  volumes(s: SoundSettings) {
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, now, 0.05);
    for (const b of ["sfx", "ui", "music"] as const) this.bus[b].gain.setTargetAtTime(s[b] * HEADROOM, now, 0.05);
  }
  /** False when the mixer refused the cue (gap, cap or a full pool). */
  play(cue: Cue) {
    const spec = RECIPES[cue.id],
      now = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    const a = admit(cue.id, spec, this.voices, this.last.get(cue.id), now);
    if (!a.play) return false;
    if (a.steal) {
      a.steal.source.stop();
      this.voices = this.voices.filter((v) => v !== a.steal);
    }
    const buffer = this.buffer(cue.id),
      source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      jitter = spec.params[1] ?? 0.05;
    source.buffer = buffer;
    // Audio jitter is render-side only; the simulation never sees it.
    source.playbackRate.value = cue.pitch * (1 + jitter * (Math.random() * 2 - 1));
    gain.gain.value = cue.gain;
    source.connect(gain).connect(this.bus[BUS_OF[spec.pool]]);
    source.start(now);
    this.voices.push({ cue: cue.id, pool: spec.pool, priority: spec.priority, start: now, end: now + buffer.duration / source.playbackRate.value, source });
    this.last.set(cue.id, now);
    if (spec.duck) this.duck(now);
    return true;
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
  private duck(now: number) {
    const g = this.duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(DUCK_LEVEL, now + 0.05);
    g.setTargetAtTime(1, now + DUCK_TIME, 0.3);
  }
}
/** Two seconds of white noise from xorshift32, the same on every load. */
function noiseBuffer(ctx: AudioContext) {
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

- [ ] **Step 3: Type-check** — Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/audio/engine.ts src/audio/ambience.ts
git commit -m "Add Web Audio engine and theme ambience"
```

---

### Task 8: Adapter and game wiring

**Files:**
- Modify: `src/app/audio.ts` (rewrite), `src/main.ts:9,45-55`, `src/app/input.ts` (sound-btn case at ~366, `applied` at ~54-66, keydown at ~473, return at 518)

**Interfaces:**
- Consumes: everything above; `Game` (`src/core/game.ts`), `Match` (`src/core/match.ts`)
- Produces: `class Audio { settings: SoundSettings; get on(): boolean; onChange(f: () => void): void; start(): Promise<void>; armAutoStart(): void; update(next: Partial<SoundSettings>): Promise<void>; cue(id: CueId): void; frame(events: readonly GameEvent[], game: Game, match: Match | null): void }`; `createInput(...)` additionally returns `match: () => Match | null`

- [ ] **Step 1: Rewrite `src/app/audio.ts`**

```ts
import { cuesFor, newlyEliminated, ReactorWatch } from "../audio/cues";
import { AudioEngine } from "../audio/engine";
import { moodOf } from "../audio/mood";
import type { CueId } from "../audio/recipes";
import { loadSettings, saveSettings, type SoundSettings } from "../audio/settings";
import type { Game } from "../core/game";
import type { Match } from "../core/match";
import type { GameEvent } from "../core/types";
// Render-side sound: reads drained events and state once per frame, never changes them.

export class Audio {
  settings: SoundSettings = loadSettings();
  private engine: AudioEngine | null = null;
  private listeners = new Set<() => void>();
  private reactor = new ReactorWatch();
  private eliminated: readonly (number | null)[] = [];
  get on() {
    return !this.settings.muted;
  }
  onChange(f: () => void) {
    this.listeners.add(f);
  }
  /** Creates or resumes the context; the first call must come from a user gesture. Throws without Web Audio. */
  async start() {
    if (!this.engine) {
      this.engine = new AudioEngine(new AudioContext());
      this.engine.volumes(this.settings);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void this.engine?.ctx.suspend();
        else if (this.on) void this.engine?.ctx.resume();
      });
    }
    await this.engine.ctx.resume();
  }
  /** A saved "on" waits for the visit's first gesture, because browsers keep a context silent until then. */
  armAutoStart() {
    if (!this.on) return;
    const go = () => {
      removeEventListener("pointerdown", go, true);
      removeEventListener("keydown", go, true);
      this.start().catch(() => undefined);
    };
    addEventListener("pointerdown", go, true);
    addEventListener("keydown", go, true);
  }
  async update(next: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...next };
    saveSettings(this.settings);
    for (const f of this.listeners) f();
    if (this.on) await this.start();
    this.engine?.volumes(this.settings);
    if (!this.on) await this.engine?.ctx.suspend();
  }
  cue(id: CueId) {
    if (this.on) this.engine?.play({ id, pitch: 1, gain: 1 });
  }
  frame(events: readonly GameEvent[], game: Game, match: Match | null) {
    const engine = this.engine;
    if (!engine || !this.on) return;
    const view = document.documentElement.dataset.view === "menu" ? "menu" : "game",
      s = game.state;
    for (const c of cuesFor(events, game.content, view)) engine.play(c);
    if (this.reactor.crossed(s, game.mission.reactorEnergy)) this.cue("lowReactor");
    if (match && newlyEliminated(this.eliminated, match.eliminatedAt, match.fields.indexOf(game)).length) this.cue("eliminated");
    this.eliminated = match ? [...match.eliminatedAt] : [];
    engine.ambience.set(moodOf({ view, theme: game.map.theme ?? "outpost", status: s.status, paused: s.paused, enemies: s.enemies.length }));
  }
}
```

- [ ] **Step 2: Wire `src/main.ts`**

Replace the `events` hook body and arm the saved setting:

```ts
const audio = new Audio();
audio.armAutoStart();
```

```ts
  events: (e) => {
    audio.frame(e, game, input.match());
    if (e.some((event) => event.type === "income")) ui.flashCredits();
  },
```

- [ ] **Step 3: Wire `src/app/input.ts`**

1. Delete the whole `case "sound-btn": { … }` block (the panel in Task 9 owns that button).
2. In `applied`, inside the versus branch where the "sends you" notice is shown, add the cue:

```ts
      if (c.type === "send" && result.ok && result.params?.target === view.player + 1) {
        ui.notice(`${playerName(player)} sends you ${result.params.enemy}!`, true);
        audio.cue("incoming");
      }
```

3. Right after `if (own || (shared && result.ok)) ui.notice(…);` add:

```ts
    if (own && !result.ok) audio.cue("reject");
```

4. In the game-view keydown handler, after the `c` block:

```ts
    if (e.key.toLowerCase() === "m") {
      audio.update({ muted: !audio.settings.muted }).catch(() => ui.notice("Audio is not available in this browser.", true));
      return;
    }
```

5. Change the return to `return { execute, chooseCell, chooseEnemy, cancel, screens, match: coop.match };`

- [ ] **Step 4: Check that `m` is free** — Run: `grep -n '"m"' src/app/input.ts src/ui/interface.ts` — Expected: only the new line. `TOWER_KEYS` is `"1234567890qwer"`.

- [ ] **Step 5: Run checks** — `npm test && npx tsc --noEmit` — Expected: all pass.

- [ ] **Step 6: Manual check (Review Focus 5)** — `npm run dev`, open `http://localhost:4173/?mission=<first mission id>`, press `M` (sound on), reload the page, click once anywhere: the ambience must fade in. Switch tabs and back: silence while hidden. Note the result in `/Volumes/T7 Shield/Temp/ion-bastion-sound/`.

- [ ] **Step 7: Commit**

```bash
git add src/app/audio.ts src/main.ts src/app/input.ts
git commit -m "Drive the sound engine from game events"
```

---

### Task 9: Mixer panel and UI sounds

**Files:**
- Create: `src/ui/sound-panel.ts`, `src/audio/ui-sounds.ts`
- Modify: `src/ui/interface.ts` (topbar `#sound-btn`, home `.home-utility`, panel markup before the template's closing backtick on line 65), `src/style.css` (append), `src/main.ts`

**Interfaces:**
- Consumes: `Audio` (Task 8), `BUSES`, `SoundSettings` (Task 2)
- Produces: `bindSoundPanel(audio: Audio, notice: (text: string) => void): void`, `bindUiSounds(audio: Audio): void`

- [ ] **Step 1: Markup in `src/ui/interface.ts`**

Topbar: replace `<button id="sound-btn" class="quiet" aria-pressed="false">Sound off</button>` with

```html
<button id="sound-btn" class="quiet sound-trigger" aria-expanded="false" aria-controls="sound-panel">Sound off</button>
```

Home: after `<button id="menu-help" class="quiet">How to Play <span>?</span></button>` add

```html
<button id="menu-sound-btn" class="quiet sound-trigger" aria-expanded="false" aria-controls="sound-panel">Sound off</button>
```

After the last `</dialog>` of the template (before the closing backtick) add

```html
<div id="sound-panel" class="sound-panel" role="dialog" aria-label="Sound settings" hidden><label class="sound-row sound-switch"><span>Sound</span><input type="checkbox" id="sound-on"></label><label class="sound-row"><span>Master</span><input type="range" min="0" max="100" data-bus="master"></label><label class="sound-row"><span>Effects</span><input type="range" min="0" max="100" data-bus="sfx"></label><label class="sound-row"><span>Interface</span><input type="range" min="0" max="100" data-bus="ui"></label><label class="sound-row"><span>Ambience</span><input type="range" min="0" max="100" data-bus="music"></label><p class="sound-hint">Press <kbd>M</kbd> in game to mute.</p></div>
```

- [ ] **Step 2: Write `src/ui/sound-panel.ts`**

```ts
import type { Audio } from "../app/audio";
import { BUSES, type Bus } from "../audio/settings";
// The sound popover: on/off and four volumes, opened from the topbar or the home page.

export function bindSoundPanel(audio: Audio, notice: (text: string) => void) {
  const panel = document.getElementById("sound-panel")!,
    toggle = panel.querySelector<HTMLInputElement>("#sound-on")!,
    triggers = [...document.querySelectorAll<HTMLButtonElement>(".sound-trigger")],
    slider = (bus: Bus) => panel.querySelector<HTMLInputElement>(`[data-bus="${bus}"]`)!;
  let opener: HTMLButtonElement | null = null;
  const apply = (next: Parameters<Audio["update"]>[0]) => audio.update(next).catch(() => notice("Audio is not available in this browser."));
  function sync() {
    const s = audio.settings;
    toggle.checked = !s.muted;
    for (const bus of BUSES) {
      slider(bus).value = String(Math.round(s[bus] * 100));
      slider(bus).disabled = s.muted;
    }
    for (const t of triggers) t.textContent = s.muted ? "Sound off" : "Sound on";
  }
  function close() {
    panel.hidden = true;
    for (const t of triggers) t.setAttribute("aria-expanded", "false");
    opener?.focus();
    opener = null;
  }
  function open(t: HTMLButtonElement) {
    const r = t.getBoundingClientRect();
    panel.style.top = `${r.bottom + 8}px`;
    panel.style.right = `${Math.max(16, innerWidth - r.right)}px`;
    panel.hidden = false;
    opener = t;
    t.setAttribute("aria-expanded", "true");
    toggle.focus();
  }
  for (const t of triggers)
    t.addEventListener("click", () => {
      if (panel.hidden) open(t);
      else close();
    });
  toggle.addEventListener("change", () => void apply({ muted: !toggle.checked }));
  panel.addEventListener("input", (e) => {
    const bus = (e.target as HTMLElement).dataset.bus as Bus | undefined;
    if (bus) void apply({ [bus]: Number((e.target as HTMLInputElement).value) / 100 });
  });
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    close();
  });
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as Element;
    if (!panel.hidden && !panel.contains(target) && !target.closest(".sound-trigger")) close();
  });
  audio.onChange(sync);
  sync();
}
```

- [ ] **Step 3: Write `src/audio/ui-sounds.ts`**

```ts
import type { Audio } from "../app/audio";
// Clicks and hover ticks on menu and HUD controls; the board's canvas is not a control and stays silent.

const CONTROLS = "button:not(:disabled), [role='tab'], a[href]";
export function bindUiSounds(audio: Audio) {
  let hovered: Element | null = null;
  document.addEventListener("click", (e) => {
    if ((e.target as Element).closest?.(CONTROLS)) audio.cue("click");
  }, true);
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const control = (e.target as Element).closest?.(CONTROLS) ?? null;
    if (control && control !== hovered) audio.cue("hover");
    hovered = control;
  }, true);
}
```

- [ ] **Step 4: Styles — append to `src/style.css`**

```css
.sound-panel {
  position: fixed;
  z-index: 120;
  width: min(280px, calc(100vw - 32px));
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: var(--glow);
  font-family: var(--mono);
  font-size: 13px;
}
.sound-panel[hidden] {
  display: none;
}
.sound-row {
  display: grid;
  grid-template-columns: 6.5em 1fr;
  align-items: center;
  gap: 10px;
  color: var(--muted);
}
.sound-switch {
  color: var(--mint);
}
.sound-row input {
  accent-color: var(--neon);
  justify-self: start;
}
.sound-row input[type="range"] {
  width: 100%;
}
.sound-hint {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
```

Check: `grep -n "z-index" src/style.css src/menu.css` — the panel's 120 must be above every other layer (highest today: 100).

- [ ] **Step 5: Wire in `src/main.ts`** after `createInput(...)`:

```ts
bindSoundPanel(audio, (text) => ui.notice(text, true));
bindUiSounds(audio);
```

with imports `import { bindSoundPanel } from "./ui/sound-panel";` and `import { bindUiSounds } from "./audio/ui-sounds";`.

- [ ] **Step 6: Run checks** — `npm test && npm run build` — Expected: pass.

- [ ] **Step 7: UX check in the browser** — `npm run dev`: open the panel from the home page and from the topbar, at desktop width and at 390 px wide. Check: the panel stays on screen, Esc closes it and returns focus to its button, Tab reaches every control, slider changes persist after reload. Ask the user to compare against one established game menu (their choice) for placement and labels; note the verdict in `/Volumes/T7 Shield/Temp/ion-bastion-sound/`.

- [ ] **Step 8: Commit**

```bash
git add src/ui/sound-panel.ts src/audio/ui-sounds.ts src/ui/interface.ts src/style.css src/main.ts
git commit -m "Add sound mixer panel and interface sounds"
```

---

### Task 10: Dev sound board

**Files:**
- Create: `src/sound-board.ts`
- Modify: `src/gallery.ts` (~98-115), `gallery.html` (intro link)

**Interfaces:**
- Consumes: `AudioEngine` (7), `cuesFor` (4), `COMBAT_CUES`, `FLOW_CUES`, `UI_CUES`, `RECIPES` (3), `DRONES` (6), `DEFAULT_SETTINGS` (2), `DEFAULT_CONTENT`
- Produces: `mountSoundBoard(root: HTMLElement): void`

- [ ] **Step 1: Write `src/sound-board.ts`**

```ts
import { cuesFor } from "./audio/cues";
import { DRONES } from "./audio/drones";
import { AudioEngine } from "./audio/engine";
import type { DroneId } from "./audio/mood";
import { COMBAT_CUES, FLOW_CUES, RECIPES, UI_CUES, type CueId } from "./audio/recipes";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { DEFAULT_CONTENT } from "./content";
import type { GameEvent, TowerId } from "./core/types";
// Dev-only page (`/gallery.html?sound`): every cue, a burst test, the drones and a review sheet copied out as text.

const CRITERIA = ["Clarity", "Fits the look", "Annoyance after 20×", "Loudness vs. others"] as const;
const GROUPS = { Combat: COMBAT_CUES, Flow: FLOW_CUES, Interface: UI_CUES } as const;
const shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => !["aura", "income", "detect", "bounty", "repair", "mark"].includes(d.attack.kind));
const at = { x: 0, y: 0 };

export function mountSoundBoard(root: HTMLElement) {
  let engine: AudioEngine | null = null;
  const rows = Object.entries(GROUPS)
    .map(([group, ids]) => `<h2>${group}</h2>` + ids.map((id) => row(id)).join(""))
    .join("");
  root.innerHTML = `<style>.sb{display:grid;gap:8px;max-width:1100px}.sb h2{margin:16px 0 4px}.sb-row{display:grid;grid-template-columns:9em 5em repeat(4,auto) 1fr;gap:8px;align-items:center}.sb-row small{color:#8fa6b8}.sb textarea{width:100%;height:12em}</style>
  <div class="sb"><p><button id="sb-start">Start audio</button> Rate each cue 1 (bad) – 5 (good). Annoyance: play it 20× in a row.</p>
  <fieldset><legend>Burst test</legend><label>Shots/s <input id="sb-rate" type="range" min="5" max="80" value="30"><output id="sb-rate-out">30</output></label>
  <label><input type="radio" name="sb-speed" value="1" checked> 1×</label><label><input type="radio" name="sb-speed" value="2"> 2×</label>
  <button id="sb-burst">Run 10 s</button> <output id="sb-burst-out"></output></fieldset>
  <fieldset><legend>Ambience</legend><select id="sb-drone">${Object.keys(DRONES).map((d) => `<option>${d}</option>`).join("")}</select>
  <label>Level <input id="sb-level" type="range" min="0" max="100" value="60"></label><button id="sb-stop">Stop</button></fieldset>
  ${rows}<p><button id="sb-copy">Copy results</button></p><textarea id="sb-out" readonly></textarea></div>`;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  function ready() {
    if (!engine) {
      engine = new AudioEngine(new AudioContext());
      engine.volumes({ ...DEFAULT_SETTINGS, muted: false });
    }
    return engine;
  }
  $("sb-start").onclick = () => void ready().ctx.resume();
  root.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) => (b.onclick = () => ready().play({ id: b.dataset.play as CueId, pitch: 1, gain: 1 })));
  $<HTMLInputElement>("sb-rate").oninput = (e) => ($("sb-rate-out").textContent = (e.target as HTMLInputElement).value);
  $("sb-burst").onclick = () => burst(ready());
  const drone = () => ready().ambience.set({ drone: $<HTMLSelectElement>("sb-drone").value as DroneId, level: Number($<HTMLInputElement>("sb-level").value) / 100 });
  $("sb-drone").onchange = drone;
  $("sb-level").oninput = drone;
  $("sb-stop").onclick = () => ready().ambience.stop();
  $("sb-copy").onclick = () => {
    const lines = [`| Cue | ${CRITERIA.join(" | ")} | Notes |`, `| --- |${CRITERIA.map(() => " --- |").join("")} --- |`];
    root.querySelectorAll<HTMLElement>(".sb-row").forEach((r) => {
      const scores = [...r.querySelectorAll<HTMLSelectElement>("select")].map((s) => s.value || "–");
      lines.push(`| ${r.dataset.cue} | ${scores.join(" | ")} | ${r.querySelector<HTMLInputElement>("input")!.value} |`);
    });
    const out = $<HTMLTextAreaElement>("sb-out");
    out.value = lines.join("\n");
    navigator.clipboard?.writeText(out.value).catch(() => out.select());
  };
}
function row(id: CueId) {
  const r = RECIPES[id],
    select = (c: string) => `<select aria-label="${c} of ${id}"><option></option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select>`;
  return `<div class="sb-row" data-cue="${id}"><button data-play="${id}">${id}</button><small>cap ${r.cap} · gap ${r.gap}s</small>${CRITERIA.map(select).join("")}<input placeholder="notes"></div>`;
}
/** Shots from every attack tower in turn, plus a kill per five shots, fed through the real cue mapping and mixer. */
function burst(engine: AudioEngine) {
  const rate = Number((document.getElementById("sb-rate") as HTMLInputElement).value),
    speed = Number(document.querySelector<HTMLInputElement>("[name=sb-speed]:checked")!.value),
    out = document.getElementById("sb-burst-out")!;
  let frames = 0, owed = 0, next = 0, played = 0, total = 0;
  const timer = setInterval(() => {
    const events: GameEvent[] = [];
    for (owed += (rate * speed) / 30; owed >= 1; owed--, next++) {
      const d = shooters[next % shooters.length];
      events.push({ type: "shot", tower: d.id as TowerId, from: at, to: at, color: d.color });
      if (next % 5 === 0) events.push({ type: "kill", at, color: d.color, reward: 5 });
    }
    for (const c of cuesFor(events, DEFAULT_CONTENT, "game")) {
      total++;
      if (engine.play(c)) played++;
    }
    out.textContent = `${played} of ${total} cues played`;
    if (++frames >= 300) clearInterval(timer);
  }, 1000 / 30);
}
```

- [ ] **Step 2: Branch in `src/gallery.ts`**

Add to the `query` constants:

```ts
  /** `?sound`: the sound board (see `sound-board.ts`); no canvas. */
  sound = query.has("sound"),
```

and wrap the `new Phaser.Game({ … })` call:

```ts
if (sound) void import("./sound-board").then((m) => m.mountSoundBoard(document.getElementById("gallery")!));
else
  new Phaser.Game({
    /* unchanged */
  });
```

In `gallery.html`, add `<a href="?sound" style="color:inherit">?sound</a> (sound board)` to the list of review pages.

- [ ] **Step 3: Run checks** — `npm test && npm run build` — Expected: pass. Check line count: `wc -l src/sound-board.ts` < 500.

- [ ] **Step 4: Commit**

```bash
git add src/sound-board.ts src/gallery.ts gallery.html
git commit -m "Add dev sound board for review"
```

---

### Task 11: Docs, final checks and listening review

**Files:**
- Modify: `CLAUDE.md`, `README.md` (line 65 and Controls table)

- [ ] **Step 1: CLAUDE.md**
  - Layout table: add the row ``| `src/audio/` | Sound (render side only): pure `cues` (events → cues), `mixer` (voice admission), `mood`/`drones` (ambience), `recipes` (ZzFX arrays), `settings`; Web Audio in `engine` and `ambience`; vendored ZzFX generator in `zzfx.ts` |``.
  - Replace "The only persisted data is the last mission id (`app/progress.ts`, localStorage)" with "Persisted data: the last mission id (`app/progress.ts`) and the sound settings (`audio/settings.ts`, key `ion-bastion:sound`), both in localStorage".
  - Commands block: add `/gallery.html?sound` (with `npm run dev` running): every cue, a burst test at 1×/2×, the theme drones and a review sheet copied as a markdown table.
  - Rules: add "Sound is render side only: `app/audio.ts` reads drained events once per frame; new `GameEvent` types get a cue in `audio/cues.ts` or stay silent on purpose. A new `MapTheme` needs a drone in `audio/drones.ts` (`tsc` enforces it)."

- [ ] **Step 2: README.md** — replace "Audio is optional and off by default." with "Sound is off by default. Turn it on with the Sound button (topbar or home page), where four sliders set the volumes; the choice is remembered. <kbd>M</kbd> mutes in game." Add `M` to the Controls table in the same format as the other keys.

- [ ] **Step 3: Full checks** — `npm test && npm run build` — Expected: all tests pass; only the chunk-size warning.

- [ ] **Step 4: Listening review (the user judges, not the agent)** — With `npm run dev`, the user opens `http://localhost:4173/gallery.html?sound`, presses Start audio, and:
  1. plays every cue and rates the four criteria;
  2. runs the burst test at 30 and 80 shots/s at 1× and 2× (criteria: no clipping or crackle, cues stay distinguishable, the burst does not drown flow cues);
  3. listens to at least five drones for 2 minutes each (criteria: no audible loop seam, not tiring, fits the theme's look);
  4. presses Copy results and pastes the table.

  Save the pasted table to `/Volumes/T7 Shield/Temp/ion-bastion-sound/review-1.md`. Retune recipes scoring ≤ 2 in the ZzFX designer (paste the new array into `RECIPES`), rerun Step 3, and repeat once.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md src/audio/recipes.ts
git commit -m "Document sound design and apply review tuning"
```
