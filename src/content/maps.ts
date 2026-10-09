import type { MapDefinition, MapTheme, Point } from "../core/types";
const STEPS: readonly Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
/**
 * Builds a map from a single ASCII sketch, the only source of truth:
 * `S` entry, `R` reactor, `=` path, `#` obstacle, `.` free build cell.
 * The path is traced from `S`; every path cell must have exactly one way on.
 */
export function parseMap(id: string, name: string, sketch: readonly string[], theme?: MapTheme): MapDefinition {
  const fail = (message: string) => {
    throw new Error(`Map ${id}: ${message}`);
  };
  const rows = sketch.length,
    columns = sketch[0]?.length ?? 0;
  if (!rows || !columns) fail("Die Skizze ist leer.");
  const at = (x: number, y: number) => sketch[y]?.[x];
  const blocked: Point[] = [];
  let start: Point | undefined,
    pathCells = 0;
  sketch.forEach((row, y) => {
    if (row.length !== columns) fail(`Zeile ${y + 1} hat ${row.length} statt ${columns} Zeichen.`);
    [...row].forEach((c, x) => {
      if (!"SR=#.".includes(c)) fail(`Unbekanntes Zeichen '${c}' bei ${x},${y}.`);
      if (c === "#") blocked.push({ x, y });
      if (c === "S") {
        if (start) fail("Mehr als ein Eintritt S.");
        start = { x, y };
      }
      if ("SR=".includes(c)) pathCells++;
    });
  });
  if (!start) fail("Kein Eintritt S.");
  const path: Point[] = [start!],
    visited = new Set([`${start!.x},${start!.y}`]);
  for (let p = start!; at(p.x, p.y) !== "R"; ) {
    const next = STEPS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).filter(
      (n) => "R=".includes(at(n.x, n.y) ?? ".") && !visited.has(`${n.x},${n.y}`),
    );
    if (next.length !== 1)
      fail(next.length ? `Pfad verzweigt bei ${p.x},${p.y}.` : `Pfad endet bei ${p.x},${p.y} ohne Reaktor R.`);
    p = next[0];
    visited.add(`${p.x},${p.y}`);
    path.push(p);
  }
  if (path.length !== pathCells) fail("Pfadfelder ohne Verbindung zum Pfad.");
  return { id, name, columns, rows, path, blocked, ...(theme && { theme }) };
}
export const OUTPOST = parseMap("outpost-07", "Außenposten 07", [
  "..................",
  ".......##.......#.",
  "................#.",
  "S=====....=====...",
  ".....=....=...=...",
  ".....=....=...=.#.",
  ".#...=....=...=...",
  ".....=....=...=...",
  ".....======...=...",
  ".##...........===R",
  "..#...............",
  "..................",
], "outpost");
export const SCHLEUSENRING = parseMap("schleusenring", "Schleusenring", [
  ".....#........##..",
  ".....##...#.......",
  "..................",
  "S==============...",
  "#.............=...",
  "#.............=.#.",
  "..............=...",
  "....===========...",
  "##..=.####........",
  ".#..=.####......#.",
  "....=============R",
  "........##........",
], "lock");
export const SPLITTERFELD = parseMap("splitterfeld", "Splitterfeld", [
  ".....#...#......#.",
  "S===...=====......",
  "...=..#=.##=.##...",
  "...=###=###=###...",
  ".#.=#..=#.#=##.==R",
  "...=###=#..=#.#=..",
  "...=###=###=###=..",
  "##.=.##=###=..#=.#",
  "...=###=..#=###=#.",
  "...=#..=###=#..=..",
  "...=====#.#=====..",
  "..#...............",
], "shard");
export const GLUTPASS = parseMap("glutpass", "Glutpass", [
  "..................",
  "S==============...",
  "..#########...=...",
  "..####.####...=...",
  "..#########...=...",
  "...============...",
  "...=...########...",
  "...=...###.####...",
  "...=...########...",
  "...==============R",
  ".....#######......",
  ".....#######......",
], "ember");
export const KERNFESTUNG = parseMap("kernfestung", "Kernfestung", [
  "........##........",
  "S================.",
  "...##.......##..=.",
  "......##........=.",
  "..============..=.",
  "..=.#....#...=..=.",
  "..=..........=.#=.",
  "..=....R======..=.",
  "..=.##......##..=.",
  "#.=.............=.",
  "..===============.",
  ".......###........",
], "core");
