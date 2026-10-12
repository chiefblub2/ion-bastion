// Synthesized instruments for the music: plain Web Audio voices with filter and amplitude envelopes (parameters after
// Tone.js's MonoSynth and FMSynth defaults). Each voice schedules one note and returns when it has died away.

export type Instrument = "pluck" | "bell" | "chime" | "bass" | "swell" | "tom" | "kick" | "snare" | "hat" | "shaker" | "click";
/** Pitched instruments play their chord tone in the octave around this frequency (Hz); the others are unpitched. */
export const REGISTER: Partial<Record<Instrument, number>> = { pluck: 520, bell: 1040, chime: 1040, bass: 65, swell: 262 };
/** Seconds from a note's start until its voice stops (polyphony counts notes inside this span). */
export const LENGTH: Record<Instrument, number> = { pluck: 0.5, bell: 1.7, chime: 0.7, bass: 0.7, swell: 2.6, tom: 0.45, kick: 0.4, snare: 0.18, hat: 0.07, shaker: 0.09, click: 0.07 };
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
    end = at + LENGTH.pluck;
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
/** FM bell: a sine carrier modulated at 3.5× with a decaying index; `decay` sets how long it rings. */
const fm =
  (decay: number, length: number, peak: number): Play =>
  (ctx, out, at, hz, v) => {
    const carrier = ctx.createOscillator(),
      modulator = ctx.createOscillator(),
      index = ctx.createGain(),
      g = envelope(ctx, at, peak * v, 0.002, decay),
      end = at + length;
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
    end = at + LENGTH.bass;
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
    end = at + LENGTH.swell;
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
    end = at + LENGTH.click;
  o.frequency.value = 1700;
  o.connect(g).connect(out);
  o.start(at);
  o.stop(end);
  return end;
};
export const INSTRUMENTS: Record<Instrument, Play> = {
  pluck,
  bell: fm(1.6, LENGTH.bell, 0.22),
  chime: fm(0.6, LENGTH.chime, 0.2),
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
