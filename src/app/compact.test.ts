import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIT_QUERY, notchSide } from "./compact";
describe("notch side", () => {
  it("follows the landscape rotation and stays unknown otherwise", () => {
    expect(notchSide(90)).toBe("left");
    expect(notchSide(-90)).toBe("right");
    expect(notchSide(270)).toBe("right");
    expect(notchSide(0)).toBeUndefined();
    expect(notchSide(undefined)).toBeUndefined();
  });
});
describe("fitted menu layout", () => {
  it("uses the same query in the stylesheets as in the app", () => {
    for (const sheet of ["../menu.css", "../ui/run.css"]) expect(readFileSync(new URL(sheet, import.meta.url), "utf8")).toContain(`@media ${FIT_QUERY} {`);
  });
});
