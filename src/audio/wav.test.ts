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
