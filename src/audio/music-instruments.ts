// The soundtrack's own voices (arpeggio, lead and the drum kit), loaded with the music (`music.ts`); the stingers'
// voices are in `instruments.ts`.
import { envelope, LENGTH, run, STINGER_INSTRUMENTS, type Burst, type Instrument, type Kit, type Play } from "./instruments";

/** The arpeggio: a square wave with a short filter blip. */
const arp: Play = (ctx, out, at, hz, v) => {
  const o = ctx.createOscillator(),
    f = ctx.createBiquadFilter(),
    g = envelope(ctx, at, 0.11 * v, 0.003, 0.22),
    end = at + LENGTH.arp;
  o.type = "square";
  o.frequency.value = hz;
  f.type = "lowpass";
  f.Q.value = 2;
  f.frequency.setValueAtTime(hz * 6, at);
  f.frequency.setTargetAtTime(hz * 2, at, 0.06);
  o.connect(f).connect(g).connect(out);
  return run([o], at, end);
};
/** The lead: two detuned saws with a delayed vibrato; it holds for `length` and releases. */
const lead: Play = (ctx, out, at, hz, v, _kit, length = LENGTH.lead) => {
  const g = ctx.createGain(),
    f = ctx.createBiquadFilter(),
    vibrato = ctx.createOscillator(),
    depth = ctx.createGain(),
    hold = Math.max(0.08, length - 0.06),
    end = at + length + 0.3,
    oscillators = [-7, 7].map((cents) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = hz;
      o.detune.value = cents;
      o.connect(f);
      vibrato.connect(depth).connect(o.detune);
      return o;
    });
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.09 * v, at + 0.025);
  g.gain.setTargetAtTime(0.07 * v, at + 0.025, 0.15);
  g.gain.setTargetAtTime(0, at + hold, 0.08);
  vibrato.frequency.value = 5.2;
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(12, at + Math.min(0.4, hold));
  f.type = "lowpass";
  f.Q.value = 1;
  f.frequency.setValueAtTime(hz * 3, at);
  f.frequency.linearRampToValueAtTime(hz * 5, at + 0.12);
  f.connect(g).connect(out);
  return run([...oscillators, vibrato], at, end);
};
/** A short noise burst through a filter, read from a position that follows the time (hits differ but repeat across runs). */
function noise(ctx: BaseAudioContext, kit: Kit, at: number, type: BiquadFilterType, freq: number, q: number) {
  const s = ctx.createBufferSource(),
    f = ctx.createBiquadFilter();
  s.buffer = kit.noise;
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  s.connect(f);
  return { source: s, out: f, offset: (at * 7.31) % 1.5 } as Burst & { out: BiquadFilterNode };
}
/** Linn-style kick: a sine sweeping down with a short click on top. */
const kick: Play = (ctx, out, at, _hz, v, kit) => {
  const o = ctx.createOscillator(),
    g = envelope(ctx, at, 0.8 * v, 0.002, 0.34),
    click = noise(ctx, kit, at, "bandpass", 3000, 0.8),
    clickGain = envelope(ctx, at, 0.25 * v, 0.0005, 0.012),
    end = at + LENGTH.kick;
  o.frequency.setValueAtTime(110, at);
  o.frequency.exponentialRampToValueAtTime(45, at + 0.1);
  o.connect(g).connect(out);
  click.out.connect(clickGain).connect(out);
  return run([o, click], at, end);
};
/** The big 80s snare: a tuned body plus noise under a gate (flat hold, then a hard cut), so its room stops short. */
const snare: Play = (ctx, out, at, _hz, v, kit) => {
  const body = ctx.createOscillator(),
    bodyGain = envelope(ctx, at, 0.22 * v, 0.001, 0.09),
    n = noise(ctx, kit, at, "highpass", 1400, 0.6),
    gate = ctx.createGain(),
    end = at + LENGTH.snare;
  body.type = "triangle";
  body.frequency.setValueAtTime(220, at);
  body.frequency.exponentialRampToValueAtTime(170, at + 0.05);
  body.connect(bodyGain).connect(out);
  gate.gain.setValueAtTime(0, at);
  gate.gain.linearRampToValueAtTime(0.24 * v, at + 0.002);
  gate.gain.linearRampToValueAtTime(0.13 * v, at + 0.12);
  gate.gain.linearRampToValueAtTime(0, at + 0.14);
  n.out.connect(gate).connect(out);
  return run([body, n], at, end);
};
/** A closed hat: high-passed noise, short and quiet. */
const hat: Play = (ctx, out, at, _hz, v, kit) => {
  const n = noise(ctx, kit, at, "highpass", 8000, 0.7),
    g = envelope(ctx, at, 0.09 * v, 0.001, 0.045);
  n.out.connect(g).connect(out);
  return run([n], at, at + LENGTH.hat);
};
/** A soft crash: high-passed noise with a long fade. */
const crash: Play = (ctx, out, at, _hz, v, kit) => {
  const n = noise(ctx, kit, at, "highpass", 6000, 0.5),
    g = envelope(ctx, at, 0.11 * v, 0.002, 1);
  n.source.loop = true;
  n.out.connect(g).connect(out);
  return run([n], at, at + LENGTH.crash);
};
/** Filtered noise sweeping up while it swells, into the next phrase. */
const riser: Play = (ctx, out, at, _hz, v, kit, length = LENGTH.riser) => {
  const n = noise(ctx, kit, at, "bandpass", 300, 3),
    g = ctx.createGain(),
    end = at + length;
  n.source.loop = true;
  n.out.frequency.setValueAtTime(300, at);
  n.out.frequency.exponentialRampToValueAtTime(5000, end);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.28 * v, end - 0.02);
  g.gain.linearRampToValueAtTime(0, end);
  n.out.connect(g).connect(out);
  return run([n.source], at, end);
};
/** Every instrument, in the sound board's order. */
export const INSTRUMENTS: Record<Instrument, Play> = {
  synthBass: STINGER_INSTRUMENTS.synthBass,
  arp,
  lead,
  bell: STINGER_INSTRUMENTS.bell,
  swell: STINGER_INSTRUMENTS.swell,
  kick,
  snare,
  hat,
  tom: STINGER_INSTRUMENTS.tom,
  crash,
  riser,
};
