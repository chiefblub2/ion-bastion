// Synthesized instruments for the synthwave soundtrack: plain Web Audio voices with filter and amplitude envelopes
// (parameters after Tone.js's MonoSynth and FMSynth defaults and the classic 80s drum machines). Each voice schedules
// one note and returns when it has died away.

export type Instrument = "synthBass" | "arp" | "lead" | "bell" | "swell" | "kick" | "snare" | "hat" | "tom" | "crash" | "riser";
/** Pitched instruments play their chord tone in the octave around this frequency (Hz); the others are unpitched (the tom takes an optional pitch). */
export const REGISTER: Partial<Record<Instrument, number>> = { synthBass: 82, arp: 660, lead: 660, bell: 1040, swell: 262 };
/** Seconds from a note's start until its voice stops (polyphony counts notes inside this span); `length` may override it. */
export const LENGTH: Record<Instrument, number> = { synthBass: 0.32, arp: 0.3, lead: 0.6, bell: 1.7, swell: 2.6, kick: 0.4, snare: 0.18, hat: 0.07, tom: 0.4, crash: 1.1, riser: 1.45 };
/** Shared material: a noise buffer for the drums. */
export interface Kit {
  noise: AudioBuffer;
}
/** `length` overrides a voice's own length where it must fit the tempo (riser, lead, held bass). */
type Play = (ctx: BaseAudioContext, out: AudioNode, at: number, hz: number, velocity: number, kit: Kit, length?: number) => number;

/** Gain that rises to `peak` in `attack` s and fades out over about `decay` s. */
function envelope(ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setTargetAtTime(0, at + attack, decay / 4);
  return g;
}
/** A noise source with the buffer position it starts from. */
interface Burst {
  source: AudioBufferSourceNode;
  offset: number;
}
/** Starts the sources at `at`, stops them at `end` and frees the voice's nodes once they ended. */
function run(sources: (AudioScheduledSourceNode | Burst)[], at: number, end: number) {
  const nodes = sources.map((s) => {
    if (!("offset" in s)) {
      s.start(at);
      return s;
    }
    s.source.start(at, s.offset);
    return s.source;
  });
  for (const s of nodes) s.stop(end);
  nodes[0].onended = () => {
    for (const s of nodes) s.disconnect();
  };
  return end;
}
/** The synth bass: saw and square through a resonant low-pass that snaps shut; `length` holds it (whole notes). */
const synthBass: Play = (ctx, out, at, hz, v, _kit, length = LENGTH.synthBass) => {
  const saw = ctx.createOscillator(),
    square = ctx.createOscillator(),
    squareGain = ctx.createGain(),
    f = ctx.createBiquadFilter(),
    g = envelope(ctx, at, 0.34 * v, 0.004, Math.max(0.24, length * 0.9));
  saw.type = "sawtooth";
  square.type = "square";
  saw.frequency.value = hz;
  square.frequency.value = hz;
  square.detune.value = -5;
  squareGain.gain.value = 0.5;
  f.type = "lowpass";
  f.Q.value = 5;
  f.frequency.setValueAtTime(hz * 9, at);
  f.frequency.setTargetAtTime(hz * 2.5, at, Math.min(0.25, length / 4));
  saw.connect(f);
  square.connect(squareGain).connect(f);
  f.connect(g).connect(out);
  return run([saw, square], at, at + length);
};
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
/** FM bell: a sine carrier modulated at 3.5× with a decaying index; `decay` sets how long it rings. */
const fm =
  (decay: number, length: number, peak: number): Play =>
  (ctx, out, at, hz, v) => {
    const carrier = ctx.createOscillator(),
      modulator = ctx.createOscillator(),
      index = ctx.createGain(),
      g = envelope(ctx, at, peak * v, 0.002, decay);
    carrier.frequency.value = hz;
    modulator.frequency.value = hz * 3.5;
    index.gain.setValueAtTime(hz * 2, at);
    index.gain.setTargetAtTime(0, at, 0.3);
    modulator.connect(index).connect(carrier.frequency);
    carrier.connect(g).connect(out);
    return run([carrier, modulator], at, at + length);
  };
const swell: Play = (ctx, out, at, hz, v) => {
  const g = ctx.createGain(),
    f = ctx.createBiquadFilter();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.12 * v, at + 0.45);
  g.gain.setTargetAtTime(0, at + 0.6, 0.5);
  f.type = "lowpass";
  f.frequency.value = 1800;
  f.connect(g).connect(out);
  const oscillators = [
    [1, -7],
    [1.5, 5],
    [2, 0],
  ].map(([ratio, cents]) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = hz * ratio;
    o.detune.value = cents;
    o.connect(f);
    return o;
  });
  return run(oscillators, at, at + LENGTH.swell);
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
/** A synth tom: a sine sweeping down from `hz` (default 150 Hz); fills pass falling pitches. */
const tom: Play = (ctx, out, at, hz, v) => {
  const o = ctx.createOscillator(),
    g = envelope(ctx, at, 0.5 * v, 0.002, 0.34),
    from = hz > 0 ? hz : 150;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(from * 0.55, at + 0.25);
  o.connect(g).connect(out);
  return run([o], at, at + LENGTH.tom);
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
export const INSTRUMENTS: Record<Instrument, Play> = {
  synthBass,
  arp,
  lead,
  bell: fm(1.6, LENGTH.bell, 0.22),
  swell,
  kick,
  snare,
  hat,
  tom,
  crash,
  riser,
};
/**
 * A stereo reverb impulse: decaying noise from xorshift32 that also darkens along its tail (a one-pole low-pass whose
 * cutoff falls), after a short pre-delay, so the room sounds smooth instead of grainy.
 */
export function impulse(ctx: BaseAudioContext, seconds = 2, decay = 3, predelay = 0.02) {
  const length = Math.floor(ctx.sampleRate * seconds),
    gap = Math.floor(ctx.sampleRate * predelay),
    b = ctx.createBuffer(2, length, ctx.sampleRate);
  let x = 0x2545f491;
  for (let ch = 0; ch < 2; ch++) {
    const data = b.getChannelData(ch);
    let y = 0;
    for (let i = gap; i < length; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      const t = (i - gap) / (length - gap),
        // Low-pass coefficient from about 9 kHz at the start to about 1.5 kHz at the end.
        a = 0.75 - 0.55 * t;
      y += a * (((x >>> 0) / 0xffffffff) * 2 - 1 - y);
      data[i] = y * (1 - t) ** decay;
    }
  }
  return b;
}
