// Synthesized instruments: plain Web Audio voices with filter and amplitude envelopes (parameters after Tone.js's
// MonoSynth and FMSynth defaults and the classic 80s drum machines). Each voice schedules one note and returns when it
// has died away. The stingers' voices live here; the soundtrack's own (`music-instruments.ts`) load with the music.
import { climb, rooted } from "./pitch";

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
export type Play = (ctx: BaseAudioContext, out: AudioNode, at: number, hz: number, velocity: number, kit: Kit, length?: number) => number;

/** Gain that rises to `peak` in `attack` s and fades out over about `decay` s. */
export function envelope(ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setTargetAtTime(0, at + attack, decay / 4);
  return g;
}
/** A noise source with the buffer position it starts from. */
export interface Burst {
  source: AudioBufferSourceNode;
  offset: number;
}
/** Starts the sources at `at`, stops them at `end` and frees the voice's nodes once they ended. */
export function run(sources: (AudioScheduledSourceNode | Burst)[], at: number, end: number) {
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
/** The voices the stingers play, which sound with or without the soundtrack. */
export const STINGER_INSTRUMENTS = { synthBass, bell: fm(1.6, LENGTH.bell, 0.22), swell, tom } satisfies Partial<Record<Instrument, Play>>;
export type StingerInstrument = keyof typeof STINGER_INSTRUMENTS;
/** A pitched instrument's chord tone around its register; unpitched instruments ignore it. */
export function pitchOf(name: Instrument, chord: readonly number[], tone: number) {
  const register = REGISTER[name];
  if (!register) return 0;
  // The bass centres on the root, so a widening chord never drops it an octave.
  return (name === "synthBass" ? rooted : climb)(register, chord, tone);
}
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
