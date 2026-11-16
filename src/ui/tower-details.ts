import { isTouch } from "./touch";
import { DEFAULT_CONTENT } from "../content";
import { effectiveTowerStats, isInAura } from "../systems/auras";
import { harmonicBonuses } from "../systems/aura-paths";
import { describeAttack, isSupport } from "../systems/attacks";
import type { ContentPack, Tower, TowerId, UnitLayer } from "../core/types";
import { resolveUpgrades, towerLevel, maxTowerLevel, towerColor, towerPath, towerTrack } from "../core/upgrades";
import { escape, number, percent, statValue } from "./format";
import { PRIORITY_LABELS } from "./messages";
import { towerBranches, type TowerBranch } from "./tower-branches";
import { gearBlock, type Standing } from "./gear-standing";
// The sidebar's read-only panel for the armed or selected tower; every action is on the card beside the tower.

const NUMERALS = ["I", "II", "III", "IV", "V"];
const hex = (color: number | string) => (typeof color === "number" ? `#${color.toString(16).padStart(6, "0")}` : color);

/**
 * Where a tower stands on its upgrade ladder: one pip per level, then the branches still to choose (names and roles)
 * or the chosen one in its colour with every tier, owned ones ticked, each with its effect. Aura: its track, then its path.
 */
export function pathLadder(tower: Tower, content: ContentPack = DEFAULT_CONTENT): string {
  const definition = content.towers[tower.type],
    level = towerLevel(tower, content),
    max = maxTowerLevel(tower.type, content),
    { paths, tracks } = towerBranches(definition),
    path = towerPath(tower, content),
    track = towerTrack(tower, content),
    accent = hex(towerColor(tower, content));
  const pips = `<div class="ladder-pips" role="img" aria-label="Level ${level} of ${max}" style="--path-color:${accent}">${Array.from(
    { length: max },
    (_, i) => `<i class="${i < level ? "on" : ""}"></i>`,
  ).join("")}</div>`;
  const chosen = (branch: TowerBranch) =>
    `<div class="ladder-branch" style="--path-color:${hex(branch.color)}"><b>${escape(branch.name)}</b>${branch.role ? ` <span>${escape(branch.role)}</span>` : ""}<ol>${branch.tiers
      .map((tier, i) => {
        const owned = tower.upgrades.includes(tier.id);
        return `<li class="${owned ? "owned" : ""}"><b>${owned ? "✓" : NUMERALS[i]}</b><span>${escape(tier.description)}</span></li>`;
      })
      .join("")}</ol></div>`;
  const choice = (branches: readonly TowerBranch[], kind: string) =>
    branches.length
      ? `<p class="ladder-next">Lv ${definition.upgrades.find((u) => u.id === branches[0].tiers[0].id)?.effects.level ?? "?"}: ${branches.length > 1 ? `one of ${branches.length} ${kind}s` : `the ${kind}`}</p><ul class="ladder-choices">${branches
          .map((b) => `<li style="--path-color:${hex(b.color)}"><b>${escape(b.name)}</b>${b.role ? ` <span>${escape(b.role)}</span>` : ""}</li>`)
          .join("")}</ul>`
      : "";
  const trackPart = tracks.length ? (track ? chosen(tracks.find((b) => b.id === track)!) : choice(tracks, "track")) : "";
  const pathPart = path ? chosen(paths.find((b) => b.id === path)!) : choice(paths, "path");
  return `<div class="path-ladder">${pips}${trackPart}${pathPart}</div>`;
}

/** Upgrading, retargeting and selling happen on the card beside the tower. */
function actionNote(targets: boolean) {
  const touch = isTouch(),
    what = targets ? "Upgrade, retarget and sell" : "Upgrade and sell";
  return `<div class="placement-note">${what} on the card beside the tower.${touch ? "" : `<br><span>U buys the next upgrade${targets ? ", T cycles the target" : ""}.</span>`}</div>`;
}

/** Attack parameters such as slowdown or chain jumps, generated from the attack module. */
const attackSummary = (type: TowerId, tower: Tower | undefined, content: ContentPack) =>
  describeAttack(resolveUpgrades(tower ?? { type, upgrades: [] }, content).attack)
    .map((row) => ` · ${row.label} <b>${statValue(row)}</b>`)
    .join("");
const targets = (layers: readonly UnitLayer[]) =>
  layers.length > 1 ? "Ground · Air" : layers[0] === "air" ? "Air only" : "Ground only";

/** How to place the armed tower: tap and ✓ on a touch screen, click (Shift+click for several) with a mouse. */
function placementNote(trap: boolean) {
  const touch = isTouch(),
    act = touch ? "Tap" : "Click",
    then = touch ? ", then ✓" : "";
  return `<div class="placement-note">${trap ? `${act} a free path cell${then}: the trap triggers when ground enemies walk over it.` : `${act} a free cell${then} to build.`}<br><span>${touch ? "✕ exits build mode." : "Esc, ✕ or right-click exits build mode. Shift+click builds several."}</span></div>`;
}
export function towerDetails(
  type: TowerId,
  tower: Tower | undefined,
  towers: readonly Tower[],
  content: ContentPack = DEFAULT_CONTENT,
  /** A campaign tower's rank and gear mark, with the base pack its texts are computed against. */
  gear?: { standing: Standing | undefined; base: ContentPack },
): string {
  const definition = content.towers[type];
  const gearHtml = gear ? gearBlock(type, gear.standing, gear.base) : "";
  const support = definition.attack.kind === "aura";
  const path = tower && towerPath(tower, content);
  // Aura: the track first (named by its tier I label), then the path.
  const track = tower && towerTrack(tower, content),
    trackName = track && definition.upgrades.find((upgrade) => upgrade.track === track)!.label;
  const level = tower && `LEVEL ${towerLevel(tower, content)} / ${maxTowerLevel(type, content)}`;
  const heading = tower
    ? support
      ? track
        ? `${level} · ${trackName!.toUpperCase()}${path ? ` · ${(definition.visual.paths?.[path]?.name ?? path).toUpperCase()}` : ""}`
        : "CHOOSE TRACK"
      : `${level}${path ? ` · ${(definition.visual.paths?.[path]?.name ?? path).toUpperCase()}` : ""}`
    : definition.name;
  let values: string;
  const resolved = resolveUpgrades(tower ?? { type, upgrades: [] }, content),
    income = resolved.attack;
  if (income.kind === "detect") {
    values = `<div class="tower-stats income-stats">
      <div><strong>${number(resolved.stats.range)}</strong><span>Cells scan radius</span></div>
    </div><p class="aura-summary">Stealthed enemies in range can be targeted by all towers. Area damage hits them even without a Detector.</p>`;
  } else if (income.kind === "income") {
    values = `<div class="tower-stats income-stats">
      <div><strong>◇ ${income.amount}</strong><span>Credits per wave</span></div>
    </div><p class="aura-summary">Pays out after every completed wave · Investment ◇ ${tower?.spent ?? definition.cost} ≙ <b>${Math.ceil((tower?.spent ?? definition.cost) / income.amount)}</b> ${Math.ceil((tower?.spent ?? definition.cost) / income.amount) === 1 ? "wave" : "waves"} of income</p>`;
  } else if (support) {
    const bonuses = harmonicBonuses(tower ?? { type, upgrades: [] }, content); // Harmonics: all three stats
    const color = `#${towerColor(tower ?? { type, upgrades: [] }, content).toString(16).padStart(6, "0")}`;
    const stat = (key: keyof typeof bonuses, label: string) =>
      `<div class="${bonuses[key] ? "active" : "inactive"}"><strong>${percent(bonuses[key])}</strong><span>${label}</span></div>`;
    values = `<div class="tower-stats aura-stats" style="--path-color:${color}">
      ${stat("damage", "Damage")}${stat("speed", "Attack speed")}${stat("range", "Range")}
    </div><p class="aura-summary">Aura radius: <b>${number(definition.range)} cells</b>${tower ? ` · <b>${towers.filter((target) => isInAura(tower, target, content)).length}</b> ${towers.filter((target) => isInAura(tower, target, content)).length === 1 ? "tower" : "towers"} supported` : ""}</p>
    <p class="aura-rule">Each track boosts one stat. For each stat the strongest bonus counts; to get several bonuses, overlap Auras with different tracks. After tier III a path adds one more effect for the towers it supports.</p>`;
  } else {
    const base = resolveUpgrades(tower ?? { type, upgrades: [] }, content).stats;
    const stats = tower
      ? effectiveTowerStats(tower, towers, content)
      : { ...base, base, bonuses: { damage: 0, speed: 0, range: 0 } };
    values = `<div class="tower-stats">
      <div${stats.bonuses.damage ? ' class="is-boosted"' : ""}><strong>${number(stats.damage)}</strong><span>Damage</span>${stats.bonuses.damage ? `<small class="aura-stat-detail">${number(base.damage)} <b>+ ${number(stats.damage - base.damage)} Aura</b></small>` : ""}</div>
      <div${stats.bonuses.range ? ' class="is-boosted"' : ""}><strong>${number(stats.range)}</strong><span>Range</span>${stats.bonuses.range ? `<small class="aura-stat-detail">${number(base.range)} <b>+ ${number(stats.range - base.range)} Aura</b></small>` : ""}</div>
      <div${stats.bonuses.speed ? ' class="is-boosted"' : ""}><strong>${number(stats.interval)} s</strong><span>Fire interval</span>${stats.bonuses.speed ? `<small class="aura-stat-detail"><b>${percent(stats.bonuses.speed)} speed</b> · Aura</small>` : ""}</div>
    </div>`;
  }
  // Traps and support towers have no target priority.
  const retargets = !isSupport(definition.attack) && definition.placement !== "path";
  const cancelLabel = tower ? "Deselect (Esc)" : "Exit build mode (Esc)";
  return `<div class="selection-heading"><span>${tower ? "TOWER SELECTED" : "BUILD MODE"}</span><span class="selection-actions"><b>${heading}</b><button id="cancel-selection" class="cancel-selection" title="${cancelLabel}" aria-label="${cancelLabel}">✕</button></span></div>
    <p>${definition.description}</p>${isSupport(definition.attack) ? "" : `<p class="tower-targets">Targets: <b>${targets(definition.targets)}</b>${attackSummary(type, tower, content)}${tower ? ` · Kills <b id="tower-kills">${tower.kills}</b>` : ""}${tower && retargets ? ` · Target: <b>${PRIORITY_LABELS[tower.priority ?? "first"]}</b>` : ""}</p>`}${values}
    ${tower ? `${gearHtml}${pathLadder(tower, content)}${actionNote(retargets)}` : `${gearHtml}${placementNote(definition.placement === "path")}`}`;
}
