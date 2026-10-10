/**
 * Prints the README mission table (markdown) for all sectors.
 * Run: npx vite-node scripts/mission-table.ts
 * The numbers are derived from the content. The focus column is the full `focus`
 * text; shorten it by hand when pasting into README.md.
 */
import { SECTORS, missionNumber } from "../src/content/missions";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

const rows = [
  "| Nr. | Mission | Schwerpunkt | Map | Wellen | Credits | HP/Welle |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];
SECTORS.forEach((sector, i) => {
  rows.push(`| **${roman(i + 1)}** | **${sector.name}** | | | | | |`);
  for (const m of sector.missions) {
    const focus = m.circle ? `${m.focus}, max. ${m.circle.limit}, alle ${m.circle.interval} s` : m.focus;
    const growth = `${Math.round((m.hpGrowth ?? 0.14) * 100)} %${m.waves.some((w) => w.hpMultiplier !== undefined) ? "¹" : ""}`;
    const nr = String(missionNumber(m)).padStart(2, "0");
    rows.push(`| ${nr} | ${m.name} | ${focus} | ${m.map.columns} × ${m.map.rows} | ${m.waves.length} | ${m.startingCredits} | ${growth} |`);
  }
});
console.log(rows.join("\n"));
