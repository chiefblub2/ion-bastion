import { availableTowers } from "../core/game";
import type { ContentPack, MissionDefinition, TowerDefinition, TowerId, UpgradeDefinition } from "../core/types";
import { resolveUpgrades } from "../core/upgrades";
import { describeAttack, isSupport, type StatRow } from "../systems/attacks";
import { escape, number, statValue } from "./format";
import { pageOf, TOWER_PAGES } from "./tower-pages";

/**
 * Tower icons: the README images (`scripts/readme-images.ts -- --only towers`), drawn with the battlefield's own
 * draw functions. Vite bundles them from docs/, so they stay in step with the README; a tower without one shows its glyph.
 */
const ART = import.meta.glob<string>("../../docs/images/towers/*.png", { eager: true, query: "?url", import: "default" });
const artOf = (id: string) => ART[`../../docs/images/towers/${id}.png`];

export interface CodexLevel {
  level: number;
  /** Build cost for level 1, otherwise the price of that upgrade. */
  cost: number;
  damage: number;
  range: number;
  interval: number;
}
export interface CodexPath {
  id: string;
  name: string;
  role?: string;
  color: string;
  /** Upgrade names and prices in tier order. */
  tiers: { label: string; cost: number }[];
}
export interface CodexTower {
  definition: TowerDefinition;
  /** Index into `TOWER_PAGES`. */
  page: number;
  /** Missions that offer it, and the first of them. */
  missions: number;
  firstMission?: { number: number; name: string };
  /** Attack towers and traps: levels 1 to 5 without a path. */
  levels: CodexLevel[];
  /** Attack parameters at level 1 (slow factor, chain jumps, …). */
  params: StatRow[];
  /** Specialization paths (attack towers) or exclusive upgrade paths (Aura). */
  paths: CodexPath[];
  /** Support towers: upgrades that belong to no path. */
  upgrades: { label: string; cost: number; description: string }[];
}
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const pad = (n: number) => String(n).padStart(2, "0");

/** Every tower of the pack, grouped by build-menu category, content order within one. */
export function codexTowers(content: ContentPack): CodexTower[] {
  const offering = (id: TowerId) => content.missions.filter((m: MissionDefinition) => availableTowers(m, content).includes(id));
  return (Object.keys(content.towers) as TowerId[])
    .map((id, index) => ({ id, index, d: content.towers[id] }))
    .sort((a, b) => pageOf(a.d) - pageOf(b.d) || a.index - b.index)
    .map(({ id, d }) => {
      const missions = offering(id),
        first = missions[0],
        plain = d.upgrades.filter((u) => !u.path),
        leveled = plain.filter((u) => u.effects.level !== undefined).sort((a, b) => a.effects.level! - b.effects.level!),
        attack = !isSupport(d.attack);
      const levels: CodexLevel[] = attack
        ? [{ level: 1, cost: d.cost, damage: d.damage, range: d.range, interval: d.interval }, ...leveled.map((u, i) => {
            const s = resolveUpgrades({ type: id, upgrades: leveled.slice(0, i + 1).map((l) => l.id) }, content).stats;
            return { level: u.effects.level!, cost: u.cost, damage: s.damage, range: s.range, interval: s.interval };
          })]
        : [];
      const byPath = new Map<string, UpgradeDefinition[]>();
      for (const u of d.upgrades) if (u.path) byPath.set(u.path, [...(byPath.get(u.path) ?? []), u]);
      const paths: CodexPath[] = [...byPath].map(([path, tiers]) => {
        const visual = d.visual.paths?.[path];
        return { id: path, name: visual?.name ?? tiers[0].label, role: visual?.role, color: hex(visual?.color ?? d.color), tiers: tiers.map((t) => ({ label: t.label, cost: t.cost })) };
      });
      return {
        definition: d,
        page: pageOf(d),
        missions: missions.length,
        firstMission: first ? { number: content.missions.indexOf(first) + 1, name: first.name } : undefined,
        levels,
        params: attack ? describeAttack(d.attack) : [],
        paths,
        upgrades: attack ? [] : plain.map((u) => ({ label: u.label, cost: u.cost, description: u.description })),
      };
    });
}

const targetText = (d: TowerDefinition) =>
  !d.targets.length ? "No targets" : d.targets.length > 1 ? "Ground · Air" : d.targets[0] === "air" ? "Air only" : "Ground only";
/** The tower's own picture, or its build-menu glyph in its colour. */
export const towerIconHtml = (d: TowerDefinition) => {
  const src = artOf(d.id);
  return src
    ? `<img class="tower-codex-art" src="${src}" alt="" width="56" height="56" loading="lazy" decoding="async">`
    : `<span class="tower-codex-glyph" style="--accent:${hex(d.color)}" aria-hidden="true">${escape(d.visual.icon)}</span>`;
};

/** Tab bar (one tab per build-menu category) and card list of the tower codex page. */
export function renderTowerCodex(content: ContentPack, page: number) {
  const towers = codexTowers(content),
    total = content.missions.length;
  const tabs = TOWER_PAGES.map((p, i) => {
    const count = towers.filter((t) => t.page === i).length,
      active = i === page;
    return count
      ? `<button class="codex-tab" role="tab" id="tower-codex-tab-${i}" data-tower-codex="${i}" aria-controls="tower-codex-list" aria-selected="${active}" tabindex="${active ? 0 : -1}">${p.name} <small>${count}</small></button>`
      : "";
  }).join("");
  const list = towers
    .filter((t) => t.page === page)
    .map((t) => {
      const d = t.definition,
        where = t.missions === total ? "every mission" : t.firstMission ? `${t.missions} of ${total} missions · from Mission ${pad(t.firstMission.number)}` : "no mission yet";
      const facts = [
        `<div><b>◇ ${d.cost}</b><span>Build cost</span></div>`,
        `<div><b>${d.placement === "path" ? "Path" : "Beside path"}</b><span>Placement</span></div>`,
        ...(isSupport(d.attack) ? (d.range ? [`<div><b>${number(d.range)}</b><span>Radius (cells)</span></div>`] : []) : [`<div><b>${targetText(d)}</b><span>Targets</span></div>`]),
      ].join("");
      const params = t.params.length ? `<p class="tower-codex-params">${t.params.map((r) => `${escape(r.label)} <b>${statValue(r)}</b>`).join(" · ")}</p>` : "";
      const levels = t.levels.length
        ? `<table class="tower-codex-levels"><caption class="sr-only">${escape(d.name)} levels 1 to ${t.levels.length}</caption><thead><tr><th scope="col">Lv</th><th scope="col">Damage</th><th scope="col">Range</th><th scope="col">Interval</th><th scope="col">Cost</th></tr></thead><tbody>${t.levels
            .map((l) => `<tr><th scope="row">${l.level}</th><td>${number(l.damage)}</td><td>${number(l.range)}</td><td>${number(l.interval)} s</td><td>◇ ${l.cost}</td></tr>`)
            .join("")}</tbody></table>`
        : "";
      const upgrades = t.upgrades.length
        ? `<h3>Upgrades</h3><ul class="tower-codex-upgrades">${t.upgrades.map((u) => `<li title="${escape(u.description)}"><span>${escape(u.label)}</span><b>◇ ${u.cost}</b></li>`).join("")}</ul>`
        : "";
      const paths = t.paths.length
        ? `<h3>${t.levels.length ? "Specializations · levels 6–8" : "Paths · pick one"}</h3><ul class="tower-codex-paths">${t.paths
            .map((p) => `<li style="--path:${p.color}"><strong>${escape(p.name)}</strong>${p.role ? `<span>${escape(p.role)}</span>` : ""}<small>${p.tiers.map((x) => `◇ ${x.cost}`).join(" → ")}</small></li>`)
            .join("")}</ul>`
        : "";
      return `<article class="codex-card tower-codex-card" style="--accent:${hex(d.color)}"><header>${towerIconHtml(d)}<span><strong>${escape(d.name)}</strong><small>${escape(d.role)} · ${where}</small></span></header><p>${escape(d.description)}</p><div class="codex-stats">${facts}</div>${params}${levels}${upgrades}${paths}</article>`;
    })
    .join("");
  return { tabs, list };
}
