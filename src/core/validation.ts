import { DEFAULT_CONTENT } from "../content";
import { attackModule, isSupport } from "../systems/attacks";
import { validateTrait } from "../systems/traits";
import { ContentError } from "./errors";
import { validateAttack, validateUpgradeDefinitions } from "./upgrades";
import type { ContentPack, EnemyDefinition, MapDefinition, MissionDefinition, Point, TowerDefinition } from "./types";

const LAYERS = ["ground", "air"];
const check = (condition: unknown, path: string, reason: string) => {
  if (!condition) throw new ContentError(path, reason);
};
const validated = new WeakSet<ContentPack>();

/** Towers and enemies of a pack; checked once per pack object. */
export function validateContent(content: ContentPack) {
  if (validated.has(content)) return;
  for (const [id, e] of Object.entries(content.enemies)) validateEnemy(e, `Gegner ${id}`, content);
  for (const [id, t] of Object.entries(content.towers)) validateTower(t, `Turm ${id}`);
  if (content.sectors) validateSectors(content);
  validated.add(content);
}

/** The sectors must list exactly the pack's missions, in order. */
export function validateSectors(content: ContentPack) {
  const ids = content.sectors!.flatMap((s) => s.missions.map((m) => m.id));
  check(
    ids.length === content.missions.length && ids.every((id, i) => id === content.missions[i].id),
    "Sektoren",
    "Die Sektoren müssen genau die Missionen in Spielreihenfolge enthalten.",
  );
  for (const s of content.sectors!) check(s.missions.length, `Sektor ${s.id}`, "Keine Missionen.");
}

export function validateEnemy(e: EnemyDefinition, path: string, content: ContentPack) {
  check(LAYERS.includes(e.layer), path, "Ungültige Gegnerebene.");
  check(e.hp > 0 && e.speed > 0 && e.reward >= 0 && e.size > 0, path, "Ungültige Gegnerwerte.");
  check(Number.isInteger(e.leak) && e.leak >= 1, path, "Ungültiger Reaktorschaden (leak).");
  check(e.visual, path, "Darstellung (visual) fehlt.");
  validateVisual(e.visual, `${path} › Darstellung`);
  for (const [i, trait] of (e.traits ?? []).entries()) {
    const problem = validateTrait(trait, content);
    check(!problem, `${path} › Eigenschaft ${i + 1}`, problem!);
  }
}

/** Shape fields of the new body shapes; polygon and glider have none to check. */
export function validateVisual(v: EnemyDefinition["visual"], path: string) {
  if (v.shape === "star") {
    check(Number.isInteger(v.points) && v.points >= 3, path, "Ungültige Zackenzahl (points): ganze Zahl ab 3.");
    check(v.inner > 0 && v.inner < 1, path, "Ungültiger Innenradius (inner): zwischen 0 und 1.");
  } else if (v.shape === "orb") check(Number.isInteger(v.moons) && v.moons >= 0, path, "Ungültige Mondzahl (moons): ganze Zahl ab 0.");
  else if (v.shape === "worm") check(Number.isInteger(v.segments) && v.segments >= 2, path, "Ungültige Segmentzahl (segments): ganze Zahl ab 2.");
}

export function validateTower(t: TowerDefinition, path: string) {
  const support = !!t.attack && isSupport(t.attack);
  check(
    Array.isArray(t.targets) && t.targets.every((l) => LAYERS.includes(l)) && support === (t.targets.length === 0),
    path,
    "Ungültige Turmziele.",
  );
  validateAttack(t, path);
  const module = attackModule(t.attack)!;
  if (t.projectile)
    check(t.projectile.speed > 0 && module.projectile !== "forbidden", path, "Ungültiges Projektil.");
  // Only an aura needs a radius; other support towers may have none.
  const area = !support || t.attack.kind === "aura";
  check(t.cost > 0 && (area ? t.range > 0 : t.range >= 0) && t.damage >= 0 && (support || t.interval > 0), path, "Ungültiger Turm.");
  if (support) check(t.damage === 0 && t.interval === 0, path, "Ungültiger Unterstützungsturm: kein Schaden, kein Schusstakt.");
  check(!module.trapOnly || t.placement === "path", path, "Diese Angriffsart gibt es nur für Fallen.");
  if (t.placement !== undefined)
    check(t.placement === "path" && !support, path, "Ungültige Platzierung: nur Angriffstürme können als Falle auf dem Weg stehen.");
  check(t.visual?.icon, path, "Symbol (visual.icon) fehlt.");
  validateUpgradeDefinitions(t, path);
}

export function validateMap(map: MapDefinition, path: string) {
  check(map.path.length >= 2, path, "Die Map benötigt einen Pfad.");
  const valid = (p: Point) =>
    Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < map.columns && p.y < map.rows;
  const cells = new Set<string>();
  map.path.forEach((p, i) => {
    check(valid(p) && !cells.has(`${p.x},${p.y}`), path, `Ungültiges Pfadfeld ${p.x},${p.y}.`);
    cells.add(`${p.x},${p.y}`);
    if (i) {
      const prev = map.path[i - 1];
      check(
        Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) === 1,
        path,
        `Der Pfad muss zusammenhängend sein (Lücke bei ${p.x},${p.y}).`,
      );
    }
  });
  if (map.loop) {
    const first = map.path[0],
      last = map.path[map.path.length - 1];
    check(map.path.length >= 4 && Math.abs(first.x - last.x) + Math.abs(first.y - last.y) === 1, path, "Der Ring muss geschlossen sein.");
  }
  for (const p of map.blocked)
    check(valid(p) && !cells.has(`${p.x},${p.y}`), path, `Ungültiges Hindernis ${p.x},${p.y}.`);
  check(map.path.length + map.blocked.length < map.columns * map.rows, path, "Die Map benötigt freie Bauflächen.");
}

export function validateMission(m: MissionDefinition, content: ContentPack = DEFAULT_CONTENT) {
  validateContent(content);
  const path = `Mission ${m.id}`;
  for (const v of [m.startingCredits, m.reactorEnergy])
    check(Number.isInteger(v) && v > 0, path, "Ungültige Startwerte.");
  check(m.hpGrowth === undefined || m.hpGrowth >= 0, path, "Ungültiger HP-Zuwachs.");
  validateMap(m.map, `${path} › Map ${m.map.id}`);
  check(!m.circle === !m.map.loop, path, "Kreislauf-Missionen brauchen eine Ring-Map und umgekehrt.");
  if (m.circle) {
    const c = m.circle;
    check(c.interval > 0 && Number.isInteger(c.limit) && c.limit > 0 && c.earlyBonus >= 0, path, "Ungültige Kreislauf-Regeln.");
  }
  check(m.waves.length, path, "Keine Wellen definiert.");
  m.waves.forEach((w, i) => {
    const at = `${path} › Welle ${i + 1}`;
    check(w.groups.length && w.bonus >= 0, at, "Ungültige Welle.");
    check(w.hpMultiplier === undefined || w.hpMultiplier > 0, at, "hpMultiplier muss > 0 sein.");
    w.groups.forEach((g, j) => {
      const group = `${at} › Gruppe ${j + 1}`;
      check(Object.hasOwn(content.enemies, g.type), group, `Unbekannter Gegner '${g.type}'.`);
      check(Number.isInteger(g.count) && g.count >= 1, group, "count muss eine ganze Zahl ≥ 1 sein.");
      check(g.interval > 0 && g.delay >= 0, group, "interval muss > 0 und delay ≥ 0 sein.");
    });
  });
  if (m.availableTowers) {
    check(m.availableTowers.length, path, "availableTowers ist leer.");
    for (const id of m.availableTowers)
      check(Object.hasOwn(content.towers, id), path, `Unbekannter Turm '${id}' in availableTowers.`);
  }
}
