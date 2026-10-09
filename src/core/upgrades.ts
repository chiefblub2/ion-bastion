import { DEFAULT_CONTENT } from "../content";
import { attackError, attackOverrideError } from "../systems/attacks";
import { ContentError } from "./errors";
import type {
  AttackSpec,
  AuraBonuses,
  CommandResult,
  ContentPack,
  GameState,
  MessageCode,
  Tower,
  TowerDefinition,
  TowerId,
  TowerStats,
  UpgradeDefinition,
} from "./types";

export type UpgradeProgress = { type: TowerId; upgrades: readonly string[] };
export type UpgradeStatus = "available" | "unaffordable" | "locked" | "excluded" | "purchased" | "unknown";
export interface UpgradeOption {
  definition?: UpgradeDefinition;
  status: UpgradeStatus;
}
/** Own values of a tower after its upgrades, before incoming aura bonuses. Read-only. */
export interface ResolvedTower {
  readonly level: number;
  readonly stats: Readonly<TowerStats>;
  /** Bonuses this tower emits; zero for attack towers. */
  readonly aura: Readonly<AuraBonuses>;
  readonly attack: Readonly<AttackSpec>;
}
const STATUS_CODES: Record<Exclude<UpgradeStatus, "available">, MessageCode> = {
  unknown: "upgrade-unknown",
  purchased: "upgrade-purchased-already",
  locked: "upgrade-locked",
  excluded: "upgrade-excluded",
  unaffordable: "upgrade-unaffordable",
};

/** Shared by purchase, button availability and the non-mutating preview. */
export function upgradeOption(
  tower: UpgradeProgress,
  id: string,
  credits: number,
  content: ContentPack = DEFAULT_CONTENT,
): UpgradeOption {
  const definition = content.towers[tower.type].upgrades.find((upgrade) => upgrade.id === id);
  if (!definition) return { status: "unknown" };
  if (tower.upgrades.includes(id)) return { definition, status: "purchased" };
  const chosen = towerPath(tower, content);
  if (definition.path && chosen && definition.path !== chosen) return { definition, status: "excluded" };
  if (definition.requires.some((required) => !tower.upgrades.includes(required)))
    return { definition, status: "locked" };
  if (credits < definition.cost) return { definition, status: "unaffordable" };
  return { definition, status: "available" };
}

export function upgradeOptions(
  tower: UpgradeProgress,
  credits = Infinity,
  content: ContentPack = DEFAULT_CONTENT,
): UpgradeOption[] {
  return content.towers[tower.type].upgrades.map((definition) =>
    upgradeOption(tower, definition.id, credits, content),
  );
}

/** The path fixed by the first purchased path upgrade, if any. */
export function towerPath(tower: UpgradeProgress, content: ContentPack = DEFAULT_CONTENT): string | undefined {
  const upgrades = content.towers[tower.type].upgrades;
  for (const id of tower.upgrades) {
    const path = upgrades.find((upgrade) => upgrade.id === id)?.path;
    if (path) return path;
  }
  return undefined;
}

/** Display colour of a built tower: its path colour once chosen. */
export function towerColor(tower: UpgradeProgress, content: ContentPack = DEFAULT_CONTENT): number {
  const definition = content.towers[tower.type], path = towerPath(tower, content);
  return (path ? definition.visual.paths?.[path]?.color : undefined) ?? definition.color;
}

/** Nothing left to buy: every upgrade is owned or excluded by the chosen path. */
export const isFullyUpgraded = (tower: UpgradeProgress, content: ContentPack = DEFAULT_CONTENT) =>
  upgradeOptions(tower, Infinity, content).every((option) => option.status === "purchased" || option.status === "excluded");

const cache = new WeakMap<ContentPack, Map<string, ResolvedTower>>();
/**
 * Resolves declarative effects in dependency order; purchasing order is irrelevant.
 * Results are memoised per content pack and upgrade list, so the simulation can
 * ask for every tower on every tick.
 */
export function resolveUpgrades(tower: UpgradeProgress, content: ContentPack = DEFAULT_CONTENT): ResolvedTower {
  let byKey = cache.get(content);
  if (!byKey) cache.set(content, (byKey = new Map()));
  const key = `${tower.type}|${tower.upgrades.join(",")}`;
  let result = byKey.get(key);
  if (!result) byKey.set(key, (result = computeUpgrades(content.towers[tower.type], tower.upgrades)));
  return result;
}

function computeUpgrades(definition: TowerDefinition, upgrades: readonly string[]): ResolvedTower {
  let level = 1;
  const stats: TowerStats = { damage: definition.damage, range: definition.range, interval: definition.interval };
  const aura: AuraBonuses =
    definition.attack.kind === "aura" ? { ...definition.attack.base } : { damage: 0, speed: 0, range: 0 };
  const attack = { ...definition.attack } as AttackSpec;
  const owned = new Set(upgrades);
  const applied = new Set<string>();
  const apply = (upgrade: UpgradeDefinition) => {
    if (!owned.has(upgrade.id) || applied.has(upgrade.id)) return;
    for (const id of upgrade.requires) {
      const prerequisite = definition.upgrades.find((candidate) => candidate.id === id);
      if (prerequisite) apply(prerequisite);
    }
    Object.assign(stats, upgrade.effects.stats);
    Object.assign(aura, upgrade.effects.aura);
    Object.assign(attack, upgrade.effects.attack);
    if (upgrade.effects.level !== undefined) level = upgrade.effects.level;
    applied.add(upgrade.id);
  };
  for (const upgrade of definition.upgrades) apply(upgrade);
  return Object.freeze({
    level,
    stats: Object.freeze(stats),
    aura: Object.freeze(aura),
    attack: Object.freeze(attack),
  });
}

export const towerLevel = (tower: UpgradeProgress, content: ContentPack = DEFAULT_CONTENT) =>
  resolveUpgrades(tower, content).level;
export const maxTowerLevel = (type: TowerId, content: ContentPack = DEFAULT_CONTENT) =>
  Math.max(1, ...content.towers[type].upgrades.map((upgrade) => upgrade.effects.level ?? 1));

/** Affordable or not, a legal next upgrade can be inspected without any mutation. */
export function previewUpgrade(tower: Tower, id: string, content: ContentPack = DEFAULT_CONTENT): Tower | null {
  if (upgradeOption(tower, id, Infinity, content).status !== "available") return null;
  return { ...tower, upgrades: [...tower.upgrades, id] };
}

export function purchaseUpgrade(
  state: GameState,
  tower: Tower,
  id: string,
  content: ContentPack = DEFAULT_CONTENT,
): CommandResult {
  const option = upgradeOption(tower, id, state.wallets[tower.owner], content);
  if (option.status !== "available" || !option.definition)
    return { ok: false, code: STATUS_CODES[option.status as Exclude<UpgradeStatus, "available">] };
  const definition = content.towers[tower.type];
  state.wallets[tower.owner] -= option.definition.cost;
  tower.spent += option.definition.cost;
  tower.upgrades.push(id);
  state.events.push({ type: "upgrade", at: { x: tower.x, y: tower.y }, tower: tower.type, color: towerColor(tower, content) });
  return {
    ok: true,
    code: "upgrade-purchased",
    params: { tower: definition.name, upgrade: option.definition.label },
    id: tower.id,
  };
}

/** Reject malformed content before it can affect money or recursive resolution. */
export function validateUpgradeDefinitions(tower: TowerDefinition, path = tower.id) {
  const definitions = new Map<string, UpgradeDefinition>();
  for (const [index, upgrade] of tower.upgrades.entries()) {
    const at = `${path} › Upgrade ${upgrade.id || index + 1}`,
      fail = (reason: string) => {
        throw new ContentError(at, reason);
      };
    if (!/^[a-z][a-z0-9-]*$/.test(upgrade.id) || definitions.has(upgrade.id)) fail("Ungültige oder doppelte Upgrade-ID.");
    if (!Number.isInteger(upgrade.cost) || upgrade.cost <= 0) fail("Ungültige Upgrade-Kosten.");
    if (!upgrade.label || !upgrade.description || !Array.isArray(upgrade.requires)) fail("Unvollständiges Upgrade.");
    if (upgrade.path !== undefined && (typeof upgrade.path !== "string" || !upgrade.path)) fail("Ungültiger Upgrade-Pfad.");
    if (upgrade.path && tower.visual?.paths && !tower.visual.paths[upgrade.path]) fail(`Pfad '${upgrade.path}' ohne Optik (visual.paths).`);
    const effects = upgrade.effects;
    if (
      !effects ||
      !(
        Object.keys(effects.stats ?? {}).length ||
        Object.keys(effects.aura ?? {}).length ||
        Object.keys(effects.attack ?? {}).length ||
        effects.level !== undefined
      )
    )
      fail("Upgrade ohne Effekt.");
    const attackProblem = effects.attack && attackOverrideError(tower.attack, effects.attack);
    if (attackProblem) fail(attackProblem);
    if (effects.level !== undefined && (!Number.isInteger(effects.level) || effects.level < 2))
      fail("Ungültige Upgrade-Stufe.");
    for (const [key, value] of Object.entries(effects.stats ?? {}))
      if (
        !["damage", "range", "interval"].includes(key) ||
        !Number.isFinite(value) ||
        value < 0 ||
        (key !== "damage" && value <= 0)
      )
        fail(`Ungültiger Upgrade-Wert '${key}'.`);
    for (const [key, value] of Object.entries(effects.aura ?? {}))
      if (tower.attack.kind !== "aura" || !["damage", "speed", "range"].includes(key) || !Number.isFinite(value) || value < 0)
        fail(`Ungültiger Aura-Upgrade-Wert '${key}'.`);
    definitions.set(upgrade.id, upgrade);
  }
  const done = new Set<string>(),
    active = new Set<string>();
  const visit = (id: string, from: string) => {
    if (done.has(id)) return;
    const upgrade = definitions.get(id);
    if (!upgrade) throw new ContentError(`${path} › Upgrade ${from}`, `Unbekannte Upgrade-Voraussetzung '${id}'.`);
    if (active.has(id)) throw new ContentError(`${path} › Upgrade ${id}`, "Zyklische Upgrade-Voraussetzungen.");
    active.add(id);
    for (const prerequisite of upgrade.requires) {
      visit(prerequisite, id);
      if (definitions.get(prerequisite)!.path !== upgrade.path)
        throw new ContentError(`${path} › Upgrade ${id}`, "Voraussetzung aus anderem Pfad.");
    }
    active.delete(id);
    done.add(id);
  };
  for (const id of definitions.keys()) visit(id, id);
}

/** Validates a tower's attack spec; used by content validation. */
export function validateAttack(tower: TowerDefinition, path: string) {
  const problem = attackError(tower.attack);
  if (problem) throw new ContentError(path, problem);
}
