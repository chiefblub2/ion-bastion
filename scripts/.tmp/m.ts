import { DEFAULT_CONTENT as C } from "../../src/content";
import { actTiers } from "../../src/run/acts";
console.log(actTiers(C).map((t) => `${t.name}: ${t.missions.length}`).join(" | "));
for (const name of ["Fog Swamp", "Zero-G", "Polar Night", "Shard Field", "Digester Tower", "Command Bridge"]) {
  const m = C.missions.find((x) => x.map.name === name)!;
  const tally = new Map<string, number>();
  for (const w of m.waves) for (const g of w.groups) tally.set(g.type, (tally.get(g.type) ?? 0) + g.count);
  console.log(name, m.startingCredits, m.reactorEnergy, [...tally].map(([k, v]) => `${k}:${v}:${C.enemies[k as "drone"].layer[0]}:${(C.enemies[k as "drone"].traits ?? []).map((t) => t.kind).join("/")}`).join(" "));
}
