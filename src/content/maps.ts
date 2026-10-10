import type { MapDefinition, MapTheme, Point } from "../core/types";
const STEPS: readonly Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
/**
 * Builds a map from a single ASCII sketch, the only source of truth:
 * `S` entry, `R` reactor, `=` path, `#` obstacle, `.` free build cell.
 * The path is traced from `S`; every path cell must have exactly one way on.
 * A sketch without `R` is a closed ring (`loop`): `S` sits on the ring, enemies leave it
 * in the first free direction (right, down, left, up) and the last cell must touch `S`.
 */
export function parseMap(id: string, name: string, sketch: readonly string[], theme?: MapTheme): MapDefinition {
  const fail = (message: string) => {
    throw new Error(`Map ${id}: ${message}`);
  };
  const rows = sketch.length,
    columns = sketch[0]?.length ?? 0;
  if (!rows || !columns) fail("The sketch is empty.");
  const at = (x: number, y: number) => sketch[y]?.[x];
  const blocked: Point[] = [];
  let start: Point | undefined,
    pathCells = 0,
    reactors = 0;
  sketch.forEach((row, y) => {
    if (row.length !== columns) fail(`Row ${y + 1} has ${row.length} characters instead of ${columns}.`);
    [...row].forEach((c, x) => {
      if (!"SR=#.".includes(c)) fail(`Unknown character '${c}' at ${x},${y}.`);
      if (c === "#") blocked.push({ x, y });
      if (c === "S") {
        if (start) fail("More than one entry S.");
        start = { x, y };
      }
      if (c === "R") reactors++;
      if ("SR=".includes(c)) pathCells++;
    });
  });
  if (!start) fail("No entry S.");
  const loop = reactors === 0,
    s = start!,
    neighbours = (p: Point) => STEPS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })),
    path: Point[] = [s],
    visited = new Set([`${s.x},${s.y}`]);
  if (loop) {
    const ways = neighbours(s).filter((n) => at(n.x, n.y) === "=").length;
    if (ways !== 2) fail(ways > 2 ? `Ring branches at ${s.x},${s.y}.` : `Ring at ${s.x},${s.y} is not closed.`);
  }
  for (let p = s; loop || at(p.x, p.y) !== "R"; ) {
    const next = neighbours(p).filter((n) => "R=".includes(at(n.x, n.y) ?? ".") && !visited.has(`${n.x},${n.y}`));
    // On a ring the entry has two ways; the first one in STEPS order sets the direction.
    if (loop && p === s) next.length = 1;
    if (loop && !next.length) {
      if (Math.abs(p.x - s.x) + Math.abs(p.y - s.y) !== 1) fail(`Ring ends at ${p.x},${p.y} without returning to S.`);
      break;
    }
    if (next.length !== 1)
      fail(next.length ? `Path branches at ${p.x},${p.y}.` : `Path ends at ${p.x},${p.y} without reactor R.`);
    p = next[0];
    visited.add(`${p.x},${p.y}`);
    path.push(p);
  }
  if (path.length !== pathCells) fail("Path cells not connected to the path.");
  return { id, name, columns, rows, path, blocked, ...(theme && { theme }), ...(loop && { loop: true as const }) };
}
export const OUTPOST = parseMap("outpost-07", "Outpost 07", [
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
export const SCHLEUSENRING = parseMap("schleusenring", "Lock Ring", [
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
export const SPLITTERFELD = parseMap("splitterfeld", "Shard Field", [
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
export const GLUTPASS = parseMap("glutpass", "Ember Pass", [
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
export const KERNFESTUNG = parseMap("kernfestung", "Core Fortress", [
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
