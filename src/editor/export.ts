import type { WaveDefinition, WaveGroup } from "../core/types";
import type { EditorDraft } from "./draft";

const q = JSON.stringify;

const constName = (id: string) => {
  const name = id.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return /^[0-9]/.test(name) || name === "" ? `MISSION_${name}` : name;
};

const group = (x: WaveGroup) =>
  `g(${q(x.type)}, ${x.count}, ${x.interval}${x.delay ? `, ${x.delay}` : ""})`;

const wave = (w: WaveDefinition) => {
  const call = `wave(${w.bonus}${w.groups.map((x) => `, ${group(x)}`).join("")})`;
  return w.hpMultiplier === undefined ? `${call},` : `{ ...${call}, hpMultiplier: ${w.hpMultiplier} },`;
};

/** Paste-ready TypeScript for a sector file: the map constant, then the mission literal as the final block. */
export function exportTypeScript(d: EditorDraft): string {
  const name = constName(d.id);
  const isRing = !d.sketch.some((row) => row.includes("R"));
  const optional = [
    d.hpGrowth !== undefined ? ` hpGrowth: ${d.hpGrowth},` : "",
    d.availableTowers ? ` availableTowers: [${d.availableTowers.map((t) => q(t)).join(", ")}],` : "",
    isRing
      ? ` circle: { interval: ${d.circle.interval}, limit: ${d.circle.limit}, earlyBonus: ${d.circle.earlyBonus} },`
      : "",
  ].join("");
  return [
    `export const ${name} = parseMap(${q(d.id)}, ${q(d.name)}, [`,
    ...d.sketch.map((row) => `  ${q(row)},`),
    `], ${q(d.theme)});`,
    "",
    "// Add to a sector's missions (imports: parseMap from content/maps, g and wave from content/waves):",
    "{",
    `  id: ${q(d.id)}, name: ${q(d.name)}, focus: ${q(d.focus)}, map: ${name},`,
    `  startingCredits: ${d.startingCredits}, reactorEnergy: ${d.reactorEnergy},${optional}`,
    "  waves: [",
    ...d.waves.map((w) => `    ${wave(w)}`),
    "  ],",
    "},",
    "",
  ].join("\n");
}
