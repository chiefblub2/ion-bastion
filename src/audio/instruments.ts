// Synthesized instruments for the music: plain Web Audio voices with filter and amplitude envelopes (parameters after
// Tone.js's MonoSynth and FMSynth defaults). Each voice schedules one note and returns when it has died away.

export type Instrument = "pluck" | "bell" | "chime" | "bass" | "swell" | "tom" | "kick" | "snare" | "hat" | "shaker" | "click" | "crash" | "riser" | "thud" | "clank" | "tick" | "slam" | "grit" | "metal";
/** Pitched instruments play their chord tone in the octave around this frequency (Hz); the others are unpitched. */
export const REGISTER: Partial<Record<Instrument, number>> = { pluck: 520, bell: 1040, chime: 1040, bass: 82, swell: 262, grit: 82 };
/** Seconds from a note's start until its voice stops (polyphony counts notes inside this span). */
export const LENGTH: Record<Instrument, number> = { pluck: 0.5, bell: 1.7, chime: 0.7, bass: 0.7, swell: 2.6, tom: 0.45, kick: 0.4, snare: 0.18, hat: 0.07, shaker: 0.14, click: 0.05, crash: 1.22, riser: 1.45, thud: 0.45, clank: 0.21, tick: 0.07, slam: 0.5, grit: 0.32, metal: 1.13 };
/** Shared material: a noise buffer and the saturation curve of the enemy kit. */
export interface Kit {
  noise: AudioBuffer;
  drive: Float32Array<ArrayBuffer>;
}
/** `length` overrides a voice's own length where it must fit the tempo (the riser). */
type Play = (ctx: BaseAudioContext, out: AudioNode, at: number, hz: number, velocity: number, kit: Kit, length?: number) => number;
/** tanh soft clipping, normalised to ±1. */
export function driveCurve(amount = 3, n = 1024) {
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) c[i] = Math.tanh(amount * ((i / (n - 1)) * 2 - 1)) / Math.tanh(amount);
  return c;
}

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
  (ctx, out, at, _hz, v, kit) => {
    const s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = envelope(ctx, at, peak * v, 0.001, decay),
      end = at + decay + 0.02;
    s.buffer = kit.noise;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    s.connect(f).connect(g).connect(out);
    s.start(at, (at * 7.31) % 1.5);
    s.stop(end);
    return end;
  };
/** A two-partial wood block. */
const click: Play = (ctx, out, at, _hz, v) => {
  const g = envelope(ctx, at, 0.5 * v, 0.001, 0.03),
    end = at + LENGTH.click;
  g.connect(out);
  for (const f of [800, 1250]) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start(at);
    o.stop(end);
  }
  return end;
};
/** Filtered noise sweeping up while it swells, into the next phrase. */
const riser: Play = (ctx, out, at, _hz, v, kit, length = LENGTH.riser) => {
  const s = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain(),
    end = at + length;
  s.buffer = kit.noise;
  s.loop = true;
  f.type = "bandpass";
  f.Q.value = 4;
  f.frequency.setValueAtTime(300, at);
  f.frequency.exponentialRampToValueAtTime(6000, end);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.5 * v, end - 0.02);
  g.gain.linearRampToValueAtTime(0, end);
  s.connect(f).connect(g).connect(out);
  s.start(at);
  s.stop(end);
  return end;
};
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
const clank = metallic(1.41, 330, 0.18, 0.7, 0.5, LENGTH.clank),
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
  f.frequency.setValueAtTime(2400, at);
  f.frequency.setTargetAtTime(600, at, 0.06);
  saw.connect(shaper);
  square.connect(shaper);
  shaper.connect(f).connect(g).connect(out);
  for (const o of [saw, square]) {
    o.start(at);
    o.stop(end);
  }
  return end;
};
export const INSTRUMENTS: Record<Instrument, Play> = {
  pluck,
  bell: fm(1.6, LENGTH.bell, 0.22),
  chime: fm(0.6, LENGTH.chime, 0.3),
  bass,
  swell,
  tom: drum(140, 70, 0.2, 0.4, 0.45),
  kick: drum(120, 45, 0.12, 0.35, 0.7),
  snare: noisy("bandpass", 1800, 0.7, 0.16, 0.3),
  hat: noisy("highpass", 7000, 0.7, 0.05, 0.12),
  shaker: noisy("bandpass", 3500, 1, 0.12, 0.35),
  click,
  crash: noisy("highpass", 5000, 0.5, 1.2, 0.18),
  riser,
  thud: saturated(150, 40, 0.14, 0.4, 0.6, LENGTH.thud),
  clank,
  tick: metallic(7.1, 3200, 0.04, 0.2, 0.06, LENGTH.tick),
  // The clank layer stays a texture under the slam's body (the clank alone is much louder).
  slam: (ctx, out, at, hz, v, kit) => Math.max(slamBody(ctx, out, at, hz, v, kit), clank(ctx, out, at, hz, v * 0.25, kit)),
  grit,
  metal: metallic(2.76, 520, 1.1, 0.45, 0.12, LENGTH.metal),
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
