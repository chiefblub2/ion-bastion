// Synthesized instruments for the music: plain Web Audio voices with filter and amplitude envelopes (parameters after
// Tone.js's MonoSynth and FMSynth defaults). Each voice schedules one note and returns when it has died away.

export type Instrument = "pluck" | "bell" | "bass" | "swell" | "tom" | "kick" | "snare" | "hat" | "shaker" | "click";
/** Pitched instruments play their chord tone in the octave around this frequency (Hz); the others are unpitched. */
export const REGISTER: Partial<Record<Instrument, number>> = { pluck: 520, bell: 1040, bass: 65, swell: 262 };
