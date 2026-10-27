/**
 * Shared pieces of the browser scripts (visual-check.ts, readme-images.ts): headless system Chrome (playwright-core,
 * channel "chrome") driving the running dev server through the app's optional WebMCP tools (`app/webmcp.ts`).
 */
import { chromium, type Page } from "playwright-core";
import { STRATEGIES } from "../src/core/strategies";
import type { MissionDefinition } from "../src/core/types";

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
/**
 * Headless Chrome flags for a software WebGL context (SwiftShader); without them headless Chrome falls back to
 * Phaser's canvas renderer, which ignores sprite tints and texture filtering.
 */
export const WEBGL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
/**
 * Fails unless `npm run dev` serves `base`, then starts the browser (`args`: extra Chrome flags). `CHROME_PATH` names
 * a Chrome or Chromium binary instead of the system Chrome (e.g. a Playwright Chromium).
 */
export async function launch(base: string, args: string[] = []) {
  try {
    await fetch(base);
  } catch {
    fail(`Kein Dev-Server unter ${base}: erst \`npm run dev\` starten.`);
  }
  const path = process.env.CHROME_PATH;
  return chromium.launch({ ...(path ? { executablePath: path } : { channel: "chrome" }), headless: true, args });
}
/**
 * The app registers its tools only if this optional browser API exists. Pages run in parallel, so all but one
 * count as hidden, and the app pauses a running wave when its tab is hidden. Collects page errors into the result.
 */
export async function prepare(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(() => {
    Object.defineProperty(document, "hidden", { get: () => false });
    Object.defineProperty(document, "visibilityState", { get: () => "visible" });
    const tools: Record<string, (v: unknown) => unknown> = {};
    (window as unknown as { __tools: typeof tools }).__tools = tools;
    (document as unknown as { modelContext: object }).modelContext = {
      registerTool: (tool: { name: string; execute: (v: unknown) => unknown }) => {
        tools[tool.name] = tool.execute;
      },
    };
  });
  return errors;
}
/** Opens the app with deep-link parameters (`mission`, `wave`, `credits`, see src/main.ts) and waits for its tools. */
export async function open(page: Page, base: string, params: Record<string, string | number>) {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  await page.goto(`${base}/?${query}`);
  await page.waitForFunction(() => "read_defense_state" in ((window as unknown as { __tools?: object }).__tools ?? {}));
}
export const call = <T>(page: Page, tool: string, input: object = {}) =>
  page.evaluate(
    ([name, value]) => (window as unknown as { __tools: Record<string, (v: unknown) => unknown> }).__tools[name](value),
    [tool, input] as const,
  ) as Promise<T>;
/** Builds the strategy A towers the current credits afford, from `next.i` on. */
export async function buildAffordable(page: Page, mission: MissionDefinition, next: { i: number }) {
  const builds = STRATEGIES[mission.id]?.A.builds ?? [];
  while (next.i < builds.length) {
    try {
      await call(page, "build_defense_tower", builds[next.i]);
      next.i++;
    } catch {
      return; // Not enough credits yet; try again before the next wave.
    }
  }
}
