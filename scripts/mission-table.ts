/**
 * Mission table (markdown) for all sectors, derived from the content.
 * Run: npx vite-node scripts/mission-table.ts            print the table to stdout
 *      npx vite-node scripts/mission-table.ts --write    update the README intro counts in place
 *      npx vite-node scripts/mission-table.ts --enemies  print a reference table of all enemies
 * `--write` replaces the two `<!-- counts:start/end -->` pairs in the README intro
 * (missions/sectors, enemy types).
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

if (!process.argv.includes("--write")) {
  const rows = [
    "| No. | Mission | Focus | Map | Waves | Credits | HP/Wave |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  let footnote = false;
  SECTORS.forEach((sector, i) => {
    rows.push(`| **${roman(i + 1)}** | **${sector.name}** | | | | | |`);
    for (const m of sector.missions) {
      const focus = m.circle ? `${m.focus}, max. ${m.circle.limit}, every ${m.circle.interval} s` : m.focus;
      const hasMult = m.waves.some((w) => w.hpMultiplier !== undefined);
      footnote ||= hasMult;
      const growth = `${Math.round((m.hpGrowth ?? 0.14) * 100)} %${hasMult ? "¹" : ""}`;
      const nr = String(missionNumber(m)).padStart(2, "0");
      rows.push(`| ${nr} | ${m.name} | ${focus} | ${m.map.columns} × ${m.map.rows} | ${m.waves.length} | ${m.startingCredits} | ${growth} |`);
    }
  });
  console.log(rows.join("\n") + (footnote ? `\n\n${FOOTNOTE}` : ""));
  process.exit(0);
}

const readme = readFileSync("README.md", "utf8");
// Intro counts: first pair = missions and sectors, second pair = enemy types.
const missionCount = SECTORS.reduce((n, s) => n + s.missions.length, 0),
  counts = [`${missionCount} missions in ${SECTORS.length} sectors`, `${Object.keys(ENEMIES).filter((id) => !RESERVE_ENEMIES.has(id)).length} enemy types`];
let k = 0;
const out = readme.replace(/<!-- counts:start -->.*?<!-- counts:end -->/g, () => `<!-- counts:start -->${counts[k++] ?? ""}<!-- counts:end -->`);
if (k !== counts.length) throw new Error(`expected ${counts.length} counts markers in README.md, found ${k}`);

writeFileSync("README.md", out);
console.log(`README.md updated (${missionCount} missions, ${SECTORS.length} sectors).`);
