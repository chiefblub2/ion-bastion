/**
 * README mission table (markdown) for all sectors.
 * Run: npx vite-node scripts/mission-table.ts            print the table to stdout
 *      npx vite-node scripts/mission-table.ts --write    rewrite README.md in place
 *      npx vite-node scripts/mission-table.ts --enemies  print a reference table of all enemies
 * Numbers are derived from the content. `--write` replaces the blocks between
 * `<!-- missions:start/end -->` (table + footnote) and the two `<!-- counts:start/end -->`
 * pairs in the intro (missions/sectors, enemy types). Hand-shortened focus texts are kept per
 * mission name; new missions get the full `focus` and a "Shorten focus" note.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SECTORS, missionNumber } from "../src/content/missions";
import { ENEMIES } from "../src/content/enemies";
import { RESERVE_ENEMIES } from "../src/core/mission-checks";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);
const FOOTNOTE = "¹ Individual waves have their own HP factor instead of the linear growth.";

if (process.argv.includes("--enemies")) {
  const num = (v: unknown) => String(v);
  const traits = (e: (typeof ENEMIES)[keyof typeof ENEMIES]) =>
    (e.traits ?? [])
      .map((t) => {
        const { kind, ...rest } = t as unknown as Record<string, unknown>;
        return [kind, Object.values(rest).map(num).join("/")].filter(Boolean).join(" ");
      })
      .join(", ") || "-";
  const out = ["| id | Name | Layer | HP | Speed | Bounty | Leak | Size | Traits |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const e of Object.values(ENEMIES)) out.push(`| ${e.id} | ${e.name} | ${e.layer} | ${e.hp} | ${e.speed} | ${e.reward} | ${e.leak} | ${e.size} | ${traits(e)} |`);
  console.log(out.join("\n"));
  process.exit(0);
}

const write = process.argv.includes("--write");
const readme = write ? readFileSync("README.md", "utf8") : "";
const START = "<!-- missions:start -->",
  END = "<!-- missions:end -->";

// Existing (hand-shortened) focus per mission name, read from the old block.
const kept = new Map<string, string>();
if (write) {
  const a = readme.indexOf(START),
    b = readme.indexOf(END);
  if (a < 0 || b < 0) throw new Error("missions markers missing in README.md");
  for (const line of readme.slice(a, b).split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length > 4 && /^\d+$/.test(cells[1])) kept.set(cells[2], cells[3]);
  }
}

const rows = [
  "| No. | Mission | Focus | Map | Waves | Credits | HP/Wave |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];
const shorten: string[] = [];
let footnote = false;
SECTORS.forEach((sector, i) => {
  rows.push(`| **${roman(i + 1)}** | **${sector.name}** | | | | | |`);
  for (const m of sector.missions) {
    const full = m.circle ? `${m.focus}, max. ${m.circle.limit}, every ${m.circle.interval} s` : m.focus;
    const old = kept.get(m.name);
    if (write && old === undefined) shorten.push(m.name);
    const hasMult = m.waves.some((w) => w.hpMultiplier !== undefined);
    footnote ||= hasMult;
    const growth = `${Math.round((m.hpGrowth ?? 0.14) * 100)} %${hasMult ? "¹" : ""}`;
    const nr = String(missionNumber(m)).padStart(2, "0");
    rows.push(`| ${nr} | ${m.name} | ${old ?? full} | ${m.map.columns} × ${m.map.rows} | ${m.waves.length} | ${m.startingCredits} | ${growth} |`);
  }
});
const table = rows.join("\n");
if (!write) {
  console.log(table);
  process.exit(0);
}

const block = `${START}\n${table}${footnote ? `\n\n${FOOTNOTE}` : ""}\n${END}`;
let out = readme.slice(0, readme.indexOf(START)) + block + readme.slice(readme.indexOf(END) + END.length);

// Intro counts: first pair = missions and sectors, second pair = enemy types.
const missionCount = SECTORS.reduce((n, s) => n + s.missions.length, 0),
  counts = [`${missionCount} missions in ${SECTORS.length} sectors`, `${Object.keys(ENEMIES).filter((id) => !RESERVE_ENEMIES.has(id)).length} enemy types`];
let k = 0;
out = out.replace(/<!-- counts:start -->.*?<!-- counts:end -->/g, () => `<!-- counts:start -->${counts[k++] ?? ""}<!-- counts:end -->`);
if (k !== counts.length) throw new Error(`expected ${counts.length} counts markers in README.md, found ${k}`);

writeFileSync("README.md", out);
for (const name of shorten) console.log(`Shorten focus: ${name}`);
console.log(`README.md updated (${missionCount} missions, ${SECTORS.length} sectors).`);
