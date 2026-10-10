/**
 * Golden replay snapshots, working tree against a git revision, summarised per mission and strategy.
 * Usage: npx vite-node scripts/snapshot-diff.ts [-- --base <rev>] [--expect id,id | --sector <sector module>]
 * Prints new, removed and changed replays; for a changed one the first diverging wave and the final trace.
 * With --expect (or the mission ids of --sector) it exits 1 if any other mission changed or vanished:
 * that usually means a new trait or field leaks into solo state.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MissionSector } from "../src/core/types";

const DIR = "src/core/__snapshots__";
const argv = process.argv.slice(2).filter((a) => a !== "--"),
  option = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined),
  base = option("--base") ?? "HEAD";

/** Replay key ("<mission> <A|B>") → { waves, final } from one snapshot file's text. */
function parse(text: string, into: Map<string, { waves?: string; final?: string }>) {
  for (const m of text.matchAll(/^exports\[`golden replays > (.+?) defense ([AB]) (\d+)`\] = `\n?"?([\s\S]*?)"?\n?`;$/gm)) {
    const key = `${m[1]} ${m[2]}`,
      entry = into.get(key) ?? {};
    if (m[3] === "1") entry.waves = m[4];
    else entry.final = m[4];
    into.set(key, entry);
  }
}
const current = new Map<string, { waves?: string; final?: string }>(),
  previous = new Map<string, { waves?: string; final?: string }>();
const files = new Set(readdirSync(DIR).filter((f) => f.startsWith("replay-") && f.endsWith(".snap")));
let tracked: string[] = [];
try {
  tracked = execFileSync("git", ["ls-tree", "--name-only", `${base}:${DIR}`], { encoding: "utf8" }).split("\n").filter((f) => f.startsWith("replay-") && f.endsWith(".snap"));
} catch {
  console.log(`Hinweis: ${base}:${DIR} nicht gefunden, alles gilt als neu.`);
}
for (const f of files) parse(readFileSync(`${DIR}/${f}`, "utf8"), current);
for (const f of tracked) parse(execFileSync("git", ["show", `${base}:${DIR}/${f}`], { encoding: "utf8", maxBuffer: 1 << 26 }), previous);

const missionOf = (key: string) => key.slice(0, key.lastIndexOf(" "));
const added = [...current.keys()].filter((k) => !previous.has(k)).sort(),
  removed = [...previous.keys()].filter((k) => !current.has(k)).sort(),
  changed = [...current.keys()].filter((k) => previous.has(k) && JSON.stringify(previous.get(k)) !== JSON.stringify(current.get(k))).sort();

/** "brackwasser A, B · flutring A" */
const group = (keys: string[]) => {
  const by = new Map<string, string[]>();
  for (const k of keys) by.set(missionOf(k), [...(by.get(missionOf(k)) ?? []), k.slice(k.lastIndexOf(" ") + 1)]);
  return [...by].map(([m, s]) => `${m} ${s.join(", ")}`).join(" · ");
};
if (!added.length && !removed.length && !changed.length) console.log(`Keine Änderungen gegenüber ${base}.`);
if (added.length) console.log(`Neu (${added.length}): ${group(added)}`);
if (removed.length) console.log(`Entfernt (${removed.length}): ${group(removed)}`);
if (changed.length) console.log(`Geändert (${changed.length}):`);
for (const k of changed) {
  const a = previous.get(k)!,
    b = current.get(k)!,
    old = (a.waves ?? "").split("\n"),
    now = (b.waves ?? "").split("\n"),
    i = old.findIndex((line, n) => line !== now[n]);
  const first = i === -1 ? (old.length === now.length ? "" : `Wellenzahl ${old.length} → ${now.length}`) : `ab ${old[i]?.split(" ")[0] ?? `w${i + 1}`}: ${old[i] ?? "–"}  →  ${now[i] ?? "–"}`;
  console.log(`  ${k}`);
  if (first) console.log(`    ${first}`);
  if (a.final !== b.final) console.log(`    Ende: ${a.final}  →  ${b.final}`);
}

const sectorPath = option("--sector");
let expected = option("--expect")?.split(",").filter(Boolean);
if (sectorPath) {
  const module = await import(resolve(sectorPath));
  const sector = Object.values(module).find((v: any) => v?.missions) as MissionSector | undefined;
  expected = [...(expected ?? []), ...(sector?.missions.map((m) => m.id) ?? [])];
}
if (expected) {
  const unexpected = [...new Set([...changed, ...removed].map(missionOf))].filter((m) => !expected!.includes(m));
  if (unexpected.length) {
    console.log(`\nFAIL unerwartet geändert: ${unexpected.join(", ")} – leckt etwas in den Solo-Zustand (optionales Feld nicht undefined, andere Reihenfolge)?`);
    process.exit(1);
  }
  console.log("\nNur erwartete Missionen geändert.");
}
