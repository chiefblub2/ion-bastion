import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentPack, EnemyId, MissionDefinition, TowerId } from "./types";
import type { Build } from "./play";

/**
 * Input cache for the campaign tests (Node only, never imported by the game). A run depends only on
 * the simulation code, the mission, the builds and the content those reach: the built towers with
 * their upgrades and the enemies of the waves, plus every enemy those name (split, brood). If none of
 * that changed, the stored result is the result, so unchanged missions are not simulated again.
 * The snapshot stays the authority: cached traces are still compared with it.
 * Off with `CAMPAIGN_CACHE=0` (`npm run test:full`) and under CI.
 */
export const CACHE_ENABLED = !process.env.CI && process.env.CAMPAIGN_CACHE !== "0";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE_DIR = join(root, "node_modules/.cache/ion-bastion");
/** Entries unused for this long are dropped when a shard writes its file. */
const MAX_AGE = 14 * 24 * 3600 * 1000;

const sha = (text: string) => createHash("sha1").update(text).digest("hex");
/** Functions and non-finite numbers would vanish in plain JSON. */
const stable = (value: unknown) =>
  JSON.stringify(value, (_, v) => (typeof v === "function" ? String(v) : typeof v === "number" && !Number.isFinite(v) ? String(v) : v));

let fingerprint: string | undefined;
/** Hash of every simulation source file: src/core (without strategies) and src/systems, tests excluded. */
export function simFingerprint() {
  if (fingerprint) return fingerprint;
  const files: string[] = [];
  const walk = (dir: string, skip: string[] = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.includes(entry.name)) walk(path);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(path);
    }
  };
  walk(join(root, "src/core"), ["strategies", "__snapshots__"]);
  walk(join(root, "src/systems"));
  return (fingerprint = sha(files.map((f) => `${relative(root, f)}\n${readFileSync(f, "utf8")}`).join("\n")));
}

/** Content a run can reach: the built towers and the wave enemies, closed over enemy ids named in their definitions. */
function reachableContent(mission: MissionDefinition, builds: readonly Build[], content: ContentPack) {
  const towerIds = [...new Set(builds.map((b) => b.tower))].sort() as TowerId[];
  const towers = towerIds.map((id) => [id, content.towers[id]] as const);
  const enemyIds = Object.keys(content.enemies) as EnemyId[];
  const named = (json: string) => enemyIds.filter((id) => json.includes(`"${id}"`));
  const seen = new Set<EnemyId>(mission.waves.flatMap((w) => w.groups.map((g) => g.type)));
  for (const id of named(stable(towers))) seen.add(id);
  const queue = [...seen];
  while (queue.length)
    for (const id of named(stable(content.enemies[queue.pop()!]))) if (!seen.has(id)) seen.add(id), queue.push(id);
  const enemies = [...seen].sort().map((id) => [id, content.enemies[id]] as const);
  return { towers, enemies };
}

/** Cache key of one run: what it checks, the mission, the strategy and the content it reaches. */
export function runKey(kind: string, mission: MissionDefinition, strategy: unknown, builds: readonly Build[], content: ContentPack) {
  return sha(stable([simFingerprint(), kind, mission, strategy, reachableContent(mission, builds, content)]));
}

interface Entry {
  value: unknown;
  used: number;
}

/** One cache file per shard, so parallel shards never write the same file. */
export function shardCache(shard: number) {
  const file = join(CACHE_DIR, `campaign-${shard}.json`);
  let entries: Record<string, Entry> = {};
  if (CACHE_ENABLED)
    try {
      entries = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      entries = {};
    }
  let dirty = false;
  return {
    /** The stored value for `key`, or `compute()` stored under it. */
    get<T>(key: string, compute: () => T): T {
      if (!CACHE_ENABLED) return compute();
      const hit = entries[key];
      if (hit) {
        hit.used = Date.now();
        dirty = true;
        return hit.value as T;
      }
      const value = compute();
      entries[key] = { value, used: Date.now() };
      dirty = true;
      return value;
    },
    save() {
      if (!CACHE_ENABLED || !dirty) return;
      const now = Date.now();
      const kept = Object.fromEntries(Object.entries(entries).filter(([, e]) => now - e.used < MAX_AGE));
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(file, JSON.stringify(kept));
    },
  };
}
