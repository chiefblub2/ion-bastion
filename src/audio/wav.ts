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
