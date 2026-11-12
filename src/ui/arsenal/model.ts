// The Arsenal page's model (`/#arsenal`): tiles, branch counts, the filter, what a purchase needs, the gear track and
// a tower's dossier, all derived from the Arsenal and the base pack. Pure: no DOM, no storage.
import { type Arsenal, canForge, canResearch, markOf, owns, rankProgress, researchPrice, veterancy } from "../../campaign/arsenal";
import { markEffects, rankPrice } from "../../campaign/gear";
import { CATALOGUE, CORE_KIT, GEAR_PRICE, MAX_MARK, RANK_BONUS, RANK_PASSIVE, VETERANCY_XP } from "../../content/arsenal";
import { pageOf } from "../../core/tower-pages";
import type { ContentPack, TowerDefinition, TowerId } from "../../core/types";
import { answers } from "../../run/threats";
import { describeAttack, isSupport } from "../../systems/attacks";
import { number } from "../format";
import { markText, ROMAN, signatureText } from "../gear-text";
import { TOWER_PAGES } from "../tower-pages";

export type ArsenalFilter = "all" | "owned" | "ready";
export const FILTERS: readonly { id: ArsenalFilter; name: string }[] = [
  { id: "all", name: "All" },
  { id: "owned", name: "Owned" },
  { id: "ready", name: "Ready" },
];

/** A tile's one status: the research price (and whether it is covered), the next mark ready to forge, owned, or maxed. */
export type TileStatus =
  | { kind: "research"; price: number; affordable: boolean }
  | { kind: "forge"; mark: number; price: number }
  | { kind: "owned" }
  | { kind: "maxed" };
export interface ArsenalTile {
  id: TowerId;
  /** Index into `TOWER_PAGES`. */
  page: number;
  name: string;
  color: number;
  core: boolean;
  owned: boolean;
  rank: number;
  mark: number;
  status: TileStatus;
  /** A purchase is possible now (research or forge). */
  ready: boolean;
}

/** Every tower the Arsenal knows (core kit and catalogue) that the pack has. */
export const arsenalIds = (content: ContentPack): TowerId[] => [...CORE_KIT, ...(Object.keys(CATALOGUE) as TowerId[])].filter((id) => id in content.towers);

function statusOf(a: Arsenal, id: TowerId): TileStatus {
  if (!owns(a, id)) {
    const price = researchPrice(id) ?? 0;
    return { kind: "research", price, affordable: canResearch(a, id) };
  }
  const mark = markOf(a, id);
  if (mark >= MAX_MARK) return { kind: "maxed" };
  return canForge(a, id) ? { kind: "forge", mark: mark + 1, price: GEAR_PRICE[mark] } : { kind: "owned" };
}

/** Every tile, by branch (`TOWER_PAGES` order); within one the core kit first, then by research price, then content order. */
export function arsenalTiles(a: Arsenal, content: ContentPack): ArsenalTile[] {
  const order = Object.keys(content.towers),
    core = (id: TowerId) => (CORE_KIT.includes(id) ? CORE_KIT.indexOf(id) : CORE_KIT.length);
  return arsenalIds(content)
    .map((id): ArsenalTile => {
      const t = content.towers[id],
        status = statusOf(a, id);
      return {
        id,
        page: pageOf(t),
        name: t.name,
        color: t.color,
        core: CORE_KIT.includes(id),
        owned: owns(a, id),
        rank: veterancy(a.xp[id]),
        mark: markOf(a, id),
        status,
        ready: status.kind === "forge" || (status.kind === "research" && status.affordable),
      };
    })
    .sort((x, y) => x.page - y.page || core(x.id) - core(y.id) || (researchPrice(x.id) ?? 0) - (researchPrice(y.id) ?? 0) || order.indexOf(x.id) - order.indexOf(y.id));
}

export interface BranchCount {
  page: number;
  name: string;
  owned: number;
  total: number;
  /** Purchases possible now in the branch: research plus forge (`affordable`). */
  ready: number;
}
export function branchCounts(tiles: readonly ArsenalTile[]): BranchCount[] {
  return TOWER_PAGES.map((p, page) => {
    const mine = tiles.filter((t) => t.page === page);
    return { page, name: p.name, owned: mine.filter((t) => t.owned).length, total: mine.length, ready: mine.filter((t) => t.ready).length };
  });
}
export const matchesFilter = (tile: ArsenalTile, filter: ArsenalFilter) => filter === "all" || (filter === "owned" ? tile.owned : tile.ready);
/** What the page opens on: the first tower with a purchase ready, else the first owned one. */
export const defaultTile = (tiles: readonly ArsenalTile[]): ArsenalTile | undefined => tiles.find((t) => t.ready) ?? tiles.find((t) => t.owned) ?? tiles[0];

/** Research of a tower not owned yet: its price and the Salvage still missing (0 when it can be bought). */
export function researchBlock(a: Arsenal, id: TowerId): { price: number; missing: number; reason: string } | undefined {
  const price = researchPrice(id);
  if (price === undefined || owns(a, id)) return undefined;
  const missing = Math.max(0, price - a.salvage);
  return { price, missing, reason: missing ? `Needs ${number(missing)} more Salvage` : "" };
}

/**
 * A mark's state: `forged`; `ready` to forge now; the next mark blocked by its `rank` (named first) or by `salvage`;
 * `later` for marks after the next one (and every mark of a tower not owned).
 */
export type NodeState = "forged" | "ready" | "rank" | "salvage" | "later";
export interface GearNode {
  /** 1–5. */
  mark: number;
  label: string;
  /** The effect in a short phrase; Mk V: the signature's sentence. */
  text: string;
  /** Mk V's signature name. */
  signature?: string;
  price: number;
  /** Veterancy rank the mark needs. */
  rank: number;
  state: NodeState;
  /** What the next mark still lacks: XP to its rank and Salvage to its price. */
  missing: { xp: number; salvage: number };
}
export function gearNodes(a: Arsenal, id: TowerId, content: ContentPack): GearNode[] {
  const t = content.towers[id],
    have = owns(a, id),
    mark = markOf(a, id),
    xp = a.xp[id] ?? 0,
    rank = veterancy(xp),
    effects = markEffects(t),
    sig = signatureText(id, content);
  return GEAR_PRICE.map((price, i): GearNode => {
    const m = i + 1,
      missing = { xp: Math.max(0, VETERANCY_XP[i] - xp), salvage: Math.max(0, price - a.salvage) },
      state: NodeState = !have ? "later" : m <= mark ? "forged" : m > mark + 1 ? "later" : rank < m ? "rank" : missing.salvage ? "salvage" : "ready";
    const text = m < MAX_MARK ? markText(effects[i], t) : (sig?.text ?? "");
    return { mark: m, label: `Mk ${ROMAN[i]}`, text, signature: m === MAX_MARK ? sig?.name : undefined, price, rank: m, state, missing: state === "rank" || state === "salvage" ? missing : { xp: 0, salvage: 0 } };
  });
}
/** The Forge button's target and why it cannot be pressed yet (rank before Salvage); undefined when every mark is forged or the tower is not owned. */
export function forgeBlock(a: Arsenal, id: TowerId, content: ContentPack): { node: GearNode; reason: string } | undefined {
  const node = gearNodes(a, id, content).find((n) => n.state === "ready" || n.state === "rank" || n.state === "salvage");
  if (!node) return undefined;
  const parts: string[] = [];
  if (node.state === "rank") parts.push(`Needs Rank ${node.rank} (${number(node.missing.xp)} more XP)`);
  if (node.missing.salvage) parts.push(`${parts.length ? "" : "Needs "}${number(node.missing.salvage)} more Salvage`);
  return { node, reason: parts.join(" and ") };
}

/** Veterancy in the player's words: progress in the rank, what the next rank brings, and the current build-price passive. */
export function veterancyOf(xp: number, cost: number) {
  const p = rankProgress(xp),
    per = Math.round(RANK_PASSIVE.build * 100),
    next =
      p.span === undefined
        ? undefined
        : { rank: p.rank + 1, xp: p.span - p.into, text: `build cost −${per}%${p.rank ? " more" : ""}, +${RANK_BONUS[p.rank]} Salvage, Mk ${ROMAN[p.rank]} can be forged` },
    passive = p.rank ? { pct: Math.round(RANK_PASSIVE.build * p.rank * 100), before: cost, after: rankPrice(cost, p.rank) } : undefined;
  return { ...p, next, passive };
}

const targetText = (t: TowerDefinition) => (!t.targets.length ? "" : t.targets.length > 1 ? "Ground · Air" : t.targets[0] === "air" ? "Air only" : "Ground only");
/** A tower's dossier: its own description, chips for its targets, placement and the needs it answers, and its base values. */
export function dossier(id: TowerId, content: ContentPack) {
  const t = content.towers[id],
    support = isSupport(t.attack),
    a = answers([id], content),
    chips: string[] = [];
  if (t.placement === "path") chips.push("On the path");
  if (!support) chips.push(targetText(t));
  if (a.air.length) chips.push("Hits air");
  if (a.detect.length) chips.push("Reveals stealth");
  if (a.under.length) chips.push("Hits burrowers");
  const values: { label: string; value: string }[] = [{ label: "Build cost", value: `◇ ${number(t.cost)}` }];
  if (!support) values.push({ label: "Damage", value: number(t.damage) }, { label: "Range", value: `${number(t.range)} cells` }, { label: "Interval", value: `${number(t.interval)} s` });
  else if (t.range > 0) values.push({ label: "Radius", value: `${number(t.range)} cells` });
  for (const r of describeAttack(t.attack)) values.push({ label: r.label, value: `${number(r.value)}${r.unit}` });
  return { page: TOWER_PAGES[pageOf(t)].name, role: t.role, description: t.description, chips: chips.filter(Boolean), values };
}

/** The Codex line: "Core · Rank 3 · Mk II", "Researched", "Locked · 150 Salvage" (or "—" outside the Arsenal). */
export function arsenalStatus(id: TowerId, a: Arsenal): string {
  if (!owns(a, id)) {
    const price = researchPrice(id);
    return price === undefined ? "—" : `Locked · ${price} Salvage`;
  }
  const rank = veterancy(a.xp[id]),
    mark = markOf(a, id);
  return [CORE_KIT.includes(id) ? "Core" : "Researched", rank ? `Rank ${rank}` : "", mark ? `Mk ${ROMAN[mark - 1]}` : ""].filter(Boolean).join(" · ");
}
