import { DEFAULT_CONTENT as C } from "../../src/content";
for (const name of ["Fog Swamp", "Zero-G", "Polar Night", "Outpost 07"]) { const m = C.missions.find((x) => x.map.name === name)!; console.log(name, m.id, m.map.path.length, m.waves.length, m.waves.slice(0,4).map(w=>w.groups.map(g=>`${g.type}x${g.count}@${g.interval}`).join("+")).join(" | ")); }
