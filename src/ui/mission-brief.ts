import type { ContentPack, EnemyId, MapDefinition, MissionDefinition } from "../core/types";
import { THEMES } from "../render/terrain";
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** Every enemy type of a mission in order of first appearance; `isNew` when no earlier mission sends it. */
export function missionEnemies(mission: MissionDefinition, content: ContentPack): { id: EnemyId; isNew: boolean }[] {
  const types = (m: MissionDefinition) => m.waves.flatMap((w) => w.groups.map((g) => g.type));
  const earlier = new Set(content.missions.slice(0, content.missions.indexOf(mission)).flatMap(types));
  return [...new Set(types(mission))].map((id) => ({ id, isNew: !earlier.has(id) }));
}
/** A small SVG of the map in its theme's colours: ground, darker obstacles, path, entry and (with a reactor) the reactor. */
export function mapPreviewSvg(map: MapDefinition): string {
  const theme = THEMES[map.theme ?? "outpost"],
    blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`)),
    path = new Set(map.path.map((p) => `${p.x},${p.y}`)),
    cells: string[] = [];
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.columns; x++) {
      const key = `${x},${y}`,
        fill = path.has(key) ? theme.path.edge : blocked.has(key) ? theme.backdrop : theme.ground[(x + y) % 2];
      cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${hex(fill)}"/>`);
    }
  const line = map.path.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(" "),
    start = map.path[0],
    end = map.path[map.path.length - 1],
    marker = (p: { x: number; y: number }, kind: string, color: number) =>
      `<circle class="map-${kind}" cx="${p.x + 0.5}" cy="${p.y + 0.5}" r="0.32" fill="${hex(color)}"/>`;
  return `<svg class="map-preview" viewBox="0 0 ${map.columns} ${map.rows}" role="img" aria-label="Map ${map.name}">${cells.join("")}<polyline points="${line}${map.loop ? ` ${start.x + 0.5},${start.y + 0.5}` : ""}" fill="none" stroke="${hex(theme.path.line)}" stroke-width="0.12" stroke-linejoin="round"/>${marker(start, "entry", 0xff6b6b)}${map.loop ? "" : marker(end, "reactor", theme.accent)}</svg>`;
}
