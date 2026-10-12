import { describe, expect, it } from "vitest";
import { copyText, isRoomCode, normalizeRoomCode } from "./room-code";
describe("room codes", () => {
  it("drops whitespace and upper-cases", () => {
    expect(normalizeRoomCode("  ab cd\n")).toBe("ABCD");
    expect(isRoomCode(normalizeRoomCode(" kqzt "))).toBe(true);
    expect(isRoomCode("ABC")).toBe(false);
    expect(isRoomCode("AB1D")).toBe(false);
  });
  it("reports a copy only when the clipboard accepted it", async () => {
    let text = "";
    expect(await copyText("ABCD", { writeText: async (t) => void (text = t) })).toBe(true);
    expect(text).toBe("ABCD");
    expect(await copyText("ABCD", { writeText: () => Promise.reject(new Error("denied")) })).toBe(false);
    expect(await copyText("ABCD", undefined)).toBe(false);
  });
});
