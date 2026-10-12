# Music Revision 3: Menace and Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the enemy side sound hostile (industrial kit, dissonance with threat) and reconnect tower shots to sound (per-shot transients, towers pulsing with their music notes).

**Architecture:** Pure additions (`tensionOffset`, `padChord(tense)`, `driveCurve`, shot cues, `Conductor.ages`), new Web Audio voices sharing a `Kit` (noise + saturation curve), and a render hook through which the scene reads per-family note ages to draw halos.

**Tech Stack:** TypeScript, Web Audio (`WaveShaperNode`), Phaser 3 render, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-music-design.md`, section "Revision 3: menace and connection".

**Branch:** `music` (continues).

## Global Constraints

- Render side only; the scene reads audio state, never the reverse into the simulation.
- Dissonance: tritone (step 6) from threat 0.5; plus minor seconds (steps 10, 14) and tritone (step 12) from 0.75; pad b9 from threat 0.6 or when losing.
- Shot transients: grid instant, gap ≥ 0.12 s, cap 1, volume ≤ 0.12, combat pool (silent in the menu).
- Pulse halo: alpha argument ≤ 0.6 (core disc 0.45 × 0.6 ≈ 0.27 ≤ 0.3), fade 0.25 s; none with sound off.
- `npm test`, `tsc`, `npm run build` green at the end.

## Review Focus

1. **Bass dissonance only above its thresholds** → `tensionOffset` tests (Task 1).
2. **Shot transients stay sparse** (one per family per frame, gap) → recipe and cue tests (Task 2).
3. **Pulses only for notes that have started** (scheduled-ahead notes don't flash early) → `Conductor.ages` test (Task 4).
4. **Enemy kit replaces the clean drums everywhere** (kick/snare/hat never used by drums) → Conductor test (Task 4).
5. **Halo within the glow caps** → code review + screenshot (Task 5).

---

### Task 1: Tension in harmony and grooves

**Files:** Modify `src/audio/harmony.ts`, `src/audio/grooves.ts`, `src/audio/sequencer.ts`; Tests `src/audio/harmony.test.ts`, `src/audio/grooves.test.ts`, `src/audio/sequencer.test.ts`

- [ ] **Step 1: Tests (RED)**

In `harmony.test.ts` replace the padChord test body with:

```ts
    expect(padChord([33, 36, 40], true)).toEqual([33, 36, 40, 46]);
    expect(padChord([33, 36, 40], false)).toEqual([33, 36, 40]);
```

Append to `grooves.test.ts` (inside the describe):

```ts
  it("grows the bass's dissonance with the threat", () => {
    expect(tensionOffset(6, 0.3)).toBe(0);
    expect(tensionOffset(6, 0.6)).toBe(6);
    expect(tensionOffset(10, 0.6)).toBe(0);
    expect(tensionOffset(10, 0.9)).toBe(1);
    expect(tensionOffset(22, 0.9)).toBe(6);
  });
```

(import `tensionOffset`). In `sequencer.test.ts`: add `threat: 0` to the `parts` constant, and in the darkened-chord test change `padChord(chordOf(MUSIC.outpost, 0, 4), "dark")` to `padChord(chordOf(MUSIC.outpost, 0, 4), true)`; add:

```ts
  it("adds the pad's tension note at high threat even when winning", () => {
    const [chord] = schedule(clock, MUSIC.outpost, { ...parts, drums: [], threat: 0.7, color: "bright" }, 0, 0.1);
    expect(chord).toEqual({ kind: "chord", notes: padChord(chordOf(MUSIC.outpost, 0), true), at: 0 });
  });
```

- [ ] **Step 2: Run** `npx vitest run src/audio/harmony.test.ts src/audio/grooves.test.ts src/audio/sequencer.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`harmony.ts`: replace `padChord` with

```ts
/** The pad's chord; under tension (high threat or a losing defense) it adds the minor ninth above the root. */
export const padChord = (chord: readonly number[], tense: boolean) => (tense ? [...chord, chord[0] + 13] : [...chord]);
```

`grooves.ts`: append

```ts
/** Semitones above the chord root per 1/16 step for the enemies' bass: a tritone from threat 0.5, minor seconds and more tritones from 0.75. */
const TENSION = [0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 1, 0, 6, 0, 1, 0];
export function tensionOffset(step: number, threat: number) {
  const i = ((step % 16) + 16) % 16;
  if (threat < 0.5) return 0;
  return threat < 0.75 ? (i === 6 ? 6 : 0) : TENSION[i];
}
```

`sequencer.ts`: add `threat: number;` (doc: "The enemies' threat, 0–1: pad tension from 0.6.") to `Parts`; in `schedule` replace `padChord(chordOf(music, Math.floor(step / 16), parts.extent), parts.color)` with `padChord(chordOf(music, Math.floor(step / 16), parts.extent), parts.color === "dark" || parts.threat >= 0.6)`.

- [ ] **Step 4: Run** the three tests — Expected: PASS (conductor/tsc may be red until Task 4: `Parts` gained `threat`).

- [ ] **Step 5: Commit** `git commit -am "Tension grows with threat: bass offsets and pad b9"`

---

### Task 2: Per-shot transients

**Files:** Modify `src/audio/recipes.ts`, `src/audio/cues.ts`; Tests `src/audio/recipes.test.ts`, `src/audio/cues.test.ts`

- [ ] **Step 1: Tests (RED)**

`recipes.test.ts` append:

```ts
  it("keeps per-shot transients instant, quiet and sparse", () => {
    for (const id of SHOT_CUES) {
      expect(TIMING[id].grid, id).toBe(0);
      expect(RECIPES[id].gap, id).toBeGreaterThanOrEqual(0.12);
      expect(RECIPES[id].cap, id).toBe(1);
      expect(RECIPES[id].params[0], id).toBeLessThanOrEqual(0.12);
    }
  });
```

(import `SHOT_CUES`). In `cues.test.ts` replace the first `cuesFor` test with:

```ts
  it("answers a shot with its family's quiet transient and voices only heavy impacts", () => {
    const shot: GameEvent = { type: "shot", tower: direct, from: at, to: at, color: 0 };
    expect(cuesFor([shot, shot], DEFAULT_CONTENT, "game")).toEqual([{ id: "shotRapid", voice: 0, gain: burstGain(2) }]);
    expect(cuesFor([{ type: "impact", tower: splash, at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([{ id: "blast", voice: 0, gain: 1 }]);
    expect(cuesFor([{ type: "impact", tower: direct, at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([]);
  });
```

- [ ] **Step 2: Run** `npx vitest run src/audio/recipes.test.ts src/audio/cues.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`recipes.ts`:
- after `COMBAT_CUES` add `export const SHOT_CUES = ["shotRapid", "shotHeavy", "shotElectric", "shotControl", "shotFire", "shotTrap"] as const;`
- `CueId` adds `| (typeof SHOT_CUES)[number]`
- after the `ui` helper add `const shot = (params: ZzfxParams): CueSpec => ({ params, pool: "combat", cap: 1, gap: 0.12, priority: 0 });`
- in `RECIPES` after `repair`:

```ts
  shotRapid: shot([0.05, 0.1, 1800, 0, 0, 0.025, 0, 1, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 1, 0, 0, -6000]),
  shotHeavy: shot([0.12, 0.1, 90, 0, 0.01, 0.08, 0, 1, -3, 0, 0, 0, 0, 0.4, 0, 0, 0, 1, 0.01, 0, -600]),
  shotElectric: shot([0.05, 0.1, 2600, 0, 0, 0.03, 0, 1, -40, 0, 0, 0, 0, 0.9, 0, 0.05, 0, 1, 0, 0, 5000]),
  shotControl: shot([0.05, 0.1, 600, 0.01, 0.01, 0.06, 4, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2000]),
  shotFire: shot([0.05, 0.1, 400, 0.005, 0.02, 0.06, 4, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 3000]),
  shotTrap: shot([0.07, 0.05, 1400, 0, 0, 0.02, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -4000]),
```

- in `TIMING` add `shotRapid: t(0, false), shotHeavy: t(0, false), shotElectric: t(0, false), shotControl: t(0, false), shotFire: t(0, false), shotTrap: t(0, false),`

`cues.ts`: import `familyOf`, `Family`; add

```ts
/** Each family's quiet transient, played the moment it fires (the music answers on the beat). */
const SHOT_CUE: Record<Family, CueId> = { rapid: "shotRapid", heavy: "shotHeavy", electric: "shotElectric", control: "shotControl", fire: "shotFire", traps: "shotTrap" };
```

and in `cueOf` a case before `impact`:

```ts
    case "shot": {
      const family = familyOf(content.towers[e.tower]);
      return family ? { id: SHOT_CUE[family], voice: 0 } : null;
    }
```

Update the file's header comment: "Shots get a quiet per-family transient; their music is the family's part (`Conductor`)."

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -am "Quiet per-shot transients per tower family"`

---

### Task 3: Industrial enemy kit

**Files:** Modify `src/audio/instruments.ts`, `src/audio/engine.ts`; Test `src/audio/instruments.test.ts`

- [ ] **Step 1: Test (RED)** `src/audio/instruments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { driveCurve } from "./instruments";

describe("driveCurve", () => {
  it("soft-clips symmetrically to ±1", () => {
    const c = driveCurve(3, 101);
    expect(c[0]).toBeCloseTo(-1);
    expect(c[100]).toBeCloseTo(1);
    expect(c[50]).toBeCloseTo(0);
    expect(c[75]).toBeCloseTo(-c[25]);
    expect(c[75]).toBeGreaterThan(0.5);
  });
});
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement in `instruments.ts`**

- `Instrument` adds `| "thud" | "clank" | "tick" | "slam" | "grit" | "metal"`; `REGISTER` adds `grit: 65`; `LENGTH` adds `thud: 0.45, clank: 0.21, tick: 0.07, slam: 0.5, grit: 0.32, metal: 1.13`.
- Replace `type Play = (… noise: AudioBuffer) => number;` with:

```ts
/** Shared material: a noise buffer and the saturation curve of the enemy kit. */
export interface Kit {
  noise: AudioBuffer;
  drive: Float32Array<ArrayBuffer>;
}
type Play = (ctx: BaseAudioContext, out: AudioNode, at: number, hz: number, velocity: number, kit: Kit) => number;
/** tanh soft clipping, normalised to ±1. */
export function driveCurve(amount = 3, n = 1024) {
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) c[i] = Math.tanh(amount * ((i / (n - 1)) * 2 - 1)) / Math.tanh(amount);
  return c;
}
```

- In `noisy` and `riser`, rename the last parameter `noise` → `kit` and use `kit.noise`.
- Before `INSTRUMENTS` add:

```ts
/** A saturated pitch sweep with a click on top: the enemies' kick (thud) and, lower, their slam. */
const saturated =
  (from: number, to: number, sweep: number, decay: number, peak: number, length: number): Play =>
  (ctx, out, at, _hz, v, kit) => {
    const o = ctx.createOscillator(),
      shaper = ctx.createWaveShaper(),
      g = envelope(ctx, at, peak * v, 0.002, decay),
      click = ctx.createOscillator(),
      clickGain = envelope(ctx, at, 0.2 * v, 0.0005, 0.015),
      end = at + length;
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(to, at + sweep);
    shaper.curve = kit.drive;
    o.connect(shaper).connect(g).connect(out);
    click.type = "square";
    click.frequency.value = 1800;
    click.connect(clickGain).connect(out);
    for (const x of [o, click]) {
      x.start(at);
      x.stop(end);
    }
    return end;
  };
/** An inharmonic FM hit with an optional noise burst: clank, tick and the metal crash. */
const metallic =
  (ratio: number, freq: number, decay: number, peak: number, noiseLevel: number, length: number): Play =>
  (ctx, out, at, _hz, v, kit) => {
    const carrier = ctx.createOscillator(),
      modulator = ctx.createOscillator(),
      index = ctx.createGain(),
      g = envelope(ctx, at, peak * v, 0.001, decay),
      end = at + length;
    carrier.frequency.value = freq;
    modulator.frequency.value = freq * ratio;
    index.gain.setValueAtTime(freq * 3, at);
    index.gain.setTargetAtTime(freq * 0.5, at, decay / 3);
    modulator.connect(index).connect(carrier.frequency);
    carrier.connect(g).connect(out);
    for (const o of [carrier, modulator]) {
      o.start(at);
      o.stop(end);
    }
    if (noiseLevel > 0) {
      const s = ctx.createBufferSource(),
        f = ctx.createBiquadFilter(),
        n = envelope(ctx, at, noiseLevel * v, 0.001, Math.min(0.08, decay));
      s.buffer = kit.noise;
      f.type = "bandpass";
      f.frequency.value = 2500;
      s.connect(f).connect(n).connect(out);
      s.start(at, (at * 7.31) % 1.5);
      s.stop(end);
    }
    return end;
  };
const clank = metallic(1.41, 330, 0.18, 0.28, 0.25, LENGTH.clank),
  slamBody = saturated(110, 45, 0.2, 0.45, 0.6, LENGTH.slam);
/** The enemies' bass: saw and square through saturation and a resonant low-pass that snaps shut. */
const grit: Play = (ctx, out, at, hz, v, kit) => {
  const saw = ctx.createOscillator(),
    square = ctx.createOscillator(),
    shaper = ctx.createWaveShaper(),
    f = ctx.createBiquadFilter(),
    g = envelope(ctx, at, 0.32 * v, 0.005, 0.28),
    end = at + LENGTH.grit;
  saw.type = "sawtooth";
  square.type = "square";
  saw.frequency.value = hz;
  square.frequency.value = hz;
  square.detune.value = 7;
  shaper.curve = kit.drive;
  f.type = "lowpass";
  f.Q.value = 4;
  f.frequency.setValueAtTime(900, at);
  f.frequency.setTargetAtTime(220, at, 0.06);
  saw.connect(shaper);
  square.connect(shaper);
  shaper.connect(f).connect(g).connect(out);
  for (const o of [saw, square]) {
    o.start(at);
    o.stop(end);
  }
  return end;
};
```

- In `INSTRUMENTS` add:

```ts
  thud: saturated(150, 40, 0.14, 0.4, 0.75, LENGTH.thud),
  clank,
  tick: metallic(7.1, 3200, 0.04, 0.08, 0.06, LENGTH.tick),
  slam: (ctx, out, at, hz, v, kit) => Math.max(slamBody(ctx, out, at, hz, v, kit), clank(ctx, out, at, hz, v * 0.6, kit)),
  grit,
  metal: metallic(2.76, 520, 1.1, 0.16, 0.12, LENGTH.metal),
```

`engine.ts`: import `driveCurve`, `type Kit`; replace `private noise: AudioBuffer;` with `private kit: Kit;`; replace `this.noise = noiseBuffer(ctx);` and the Ambience line with:

```ts
    this.kit = { noise: noiseBuffer(ctx), drive: driveCurve() };
    this.ambience = new Ambience(ctx, this.bus.music, this.kit.noise);
```

and pass `this.kit` instead of `this.noise` in `instrument()`.

- [ ] **Step 4: Run** `npx vitest run src/audio` — Expected: PASS (`tsc` may still be red from Task 1 in `conductor.ts`).

- [ ] **Step 5: Commit** `git add src/audio && git commit -m "Industrial enemy kit: thud, clank, tick, slam, grit bass, metal"`

---

### Task 4: Conductor plays the menace and reports note ages

**Files:** Modify `src/audio/conductor.ts`; Test `src/audio/conductor.test.ts`

- [ ] **Step 1: Tests (RED)** — in `conductor.test.ts`: the `Recorder` stores `hz` too (`notes: { name; at; hz; bus? }`, `instrument(name, hz, at, _v, _p, bus)`); append:

```ts
  it("plays the enemies on the industrial kit with dissonance at high threat", () => {
    const { r } = run(0, 2, rapid, 0, 0.9),
      names = new Set(r.notes.map((n) => n.name));
    for (const clean of ["kick", "snare", "hat", "tom", "bass"] as const) expect(names.has(clean), clean).toBe(false);
    for (const machine of ["thud", "clank", "tick", "grit"] as const) expect(names.has(machine), machine).toBe(true);
    const step = 60 / MUSIC.outpost.bpm / 4;
    const grit = r.notes.filter((n) => n.name === "grit" && n.at < 16 * step),
      root = grit.find((n) => Math.abs(n.at) < 1e-6)!,
      tritone = grit.find((n) => Math.abs(n.at - 6 * step) < 1e-6)!;
    expect(12 * Math.log2(tritone.hz / root.hz)).toBeCloseTo(6);
  });
  it("reports how long ago each family's latest note began, ignoring notes still ahead", () => {
    const r = new Recorder(),
      c = new Conductor(r);
    c.theme("outpost", 0);
    c.shots([{ type: "shot", tower: rapid, from: at, to: at, color: 0 }], DEFAULT_CONTENT, 0);
    c.measure({ threat: 0, defense: 0, clear: 5, heavies: 0, bosses: 0, drums: true, playing: true });
    c.window(0, 0.1);
    expect(c.ages(-0.01).rapid).toBeUndefined();
    expect(c.ages(0.05).rapid).toBeCloseTo(0.05);
  });
```

(import `MUSIC` from `./harmony`.)

- [ ] **Step 2: Run** `npx vitest run src/audio/conductor.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement in `conductor.ts`**

- import `tensionOffset` from `./grooves`.
- `DRUMS` becomes:

```ts
/** The enemies' kit: machines, not a drum set. */
const DRUMS: Record<Drum, Player> = {
  kick: { instrument: "thud", pan: 0, gain: 0.8 },
  snare: { instrument: "clank", pan: 0.05, gain: 0.6 },
  hat: { instrument: "tick", pan: 0.15, gain: 0.5 },
  hat16: { instrument: "tick", pan: -0.15, gain: 0.3 },
  stomp: { instrument: "slam", pan: 0, gain: 0.8 },
  fill: { instrument: "slam", pan: -0.1, gain: 0.6 },
  bass: { instrument: "grit", pan: 0, gain: 0.6 },
  bass8: { instrument: "grit", pan: 0, gain: 0.65 },
  crash: { instrument: "metal", pan: 0.1, gain: 0.7 },
  riser: { instrument: "riser", pan: 0, gain: 0.8 },
};
```

- `parts` initial value and `measure` add `threat: m.playing && m.drums ? m.threat : 0`.
- Add the note-age bookkeeping:

```ts
  private started: Partial<Record<Family, number[]>> = {};
  /** Seconds since each family's latest part note began (notes scheduled ahead do not count yet). */
  ages(now: number) {
    const out: Partial<Record<Family, number>> = {};
    for (const [family, times] of Object.entries(this.started) as [Family, number[]][]) {
      const kept = times.filter((t) => t > now - 1),
        begun = kept.filter((t) => t <= now);
      this.started[family] = kept;
      if (begun.length) out[family] = now - Math.max(...begun);
    }
    return out;
  }
```

- In `window`, for `part` beats push the time: `(this.started[b.family] ??= []).push(b.at);`
- Replace the drum branch with tension-aware bass:

```ts
      else {
        const player = DRUMS[b.drum],
          offset = b.drum === "bass" || b.drum === "bass8" ? tensionOffset(stepOf(this.score.clock, b.at), this.parts.threat) : 0;
        this.note(player, 0, 1, b.at, 2 ** (offset / 12));
      }
```

with `import { stepAt as stepOf } from "./clock";` (`stepAt` from clock gives the 1/16 step at a time).

- [ ] **Step 4: Run** `npx vitest run src/audio && npx tsc --noEmit` — Expected: PASS, clean except the sound board/renderer if they build `Parts` themselves (they don't; they call `measure`).

- [ ] **Step 5: Commit** `git commit -am "Conductor: industrial kit, dissonant bass, note ages for pulses"`

---

### Task 5: Towers pulse with their notes

**Files:** Modify `src/app/audio.ts`, `src/render/scene.ts`, `src/main.ts`

- [ ] **Step 1: `app/audio.ts`** — add:

```ts
  /** Seconds since each tower family's latest music note began; empty while sound is off. */
  pulses() {
    const s = this.live();
    return s ? s.conductor.ages(s.ctx.currentTime) : {};
  }
```

- [ ] **Step 2: `render/scene.ts`**
  - `Hooks` gains `/** Seconds since each tower family's latest music note (sound on); towers pulse with it. */ pulses?: () => Partial<Record<Family, number>>;` (import `familyOf`, `type Family` from `../audio/families`, `halo` from `./material` if not imported).
  - Add `const PULSE = 0.25;` near the other constants.
  - In the tower loop, read the ages once before it (`const pulses = this.hooks.pulses?.() ?? {};`) and after `drawTower(…)`:

```ts
      const family = familyOf(d),
        age = family ? pulses[family] : undefined;
      // The music visibly comes from the towers: a soft halo when their family's note sounds.
      if (age !== undefined && age < PULSE) halo(this.towerGlow, px(t.x), px(t.y), CELL * 0.6, towerColor(t, content), 0.6 * (1 - age / PULSE));
```

- [ ] **Step 3: `main.ts`** — in the `Battlefield` hooks add `pulses: () => audio.pulses(),`.

- [ ] **Step 4: Run** `npx tsc --noEmit && npm test && npm run build` — Expected: green.

- [ ] **Step 5: Screenshot check** — headless Chrome (WebGL args), sound saved on, mission outpost-07, build strategy A, start a wave, take screenshots every 60 ms for 1 s into `visual-check/sound/pulse-*.png`; the user compares a pulsing and a resting frame.

- [ ] **Step 6: Commit** `git commit -am "Towers pulse with their family's music notes"`

---

### Task 6: Renders, docs, review

- [ ] **Step 1:** add an `enemies` scene to `scripts/render-music.ts` (`families: []`, `rate: 0`, `threat: 0.95`, `heavies: 2`) and render; ledger the levels.
- [ ] **Step 2:** CLAUDE.md Sound section: add "Enemies play an industrial kit (`thud`, `clank`, `tick`, `slam`, `grit`, `metal` in `instruments.ts`, saturation via `driveCurve`), with bass dissonance from `tensionOffset`; shots get a quiet per-family transient (`SHOT_CUES`); towers pulse with their family's notes through the battlefield hook `pulses` (`Conductor.ages`)."
- [ ] **Step 3:** `npm test && npm run build`; commit "Document menace and pulses".
- [ ] **Step 4:** Final review (fresh reviewer, also covering the post-review climax commit 479c585), fix pass, then the user listens and looks.
