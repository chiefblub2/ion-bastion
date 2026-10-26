import { describe, expect, it } from "vitest";
import { notchSide } from "./compact";
describe("notch side", () => {
  it("follows the landscape rotation and stays unknown otherwise", () => {
    expect(notchSide(90)).toBe("left");
    expect(notchSide(-90)).toBe("right");
    expect(notchSide(270)).toBe("right");
    expect(notchSide(0)).toBeUndefined();
    expect(notchSide(undefined)).toBeUndefined();
  });
});
