import { DEFAULT_CONTENT } from "../content";
import { sellValue } from "../core/game";
import { auraBonuses, effectiveTowerStats, isInAura } from "../systems/auras";
import { describeAttack, isSupport } from "../systems/attacks";
import type { ContentPack, Tower, TowerId, UnitLayer } from "../core/types";
import { resolveUpgrades, towerLevel, maxTowerLevel, towerColor, towerPath } from "../core/upgrades";
import { number, percent, statValue } from "./format";
import { upgradeControl } from "./upgrade-tooltip";
import { PRIORITY_LABELS } from "./messages";
import { TARGET_PRIORITIES } from "../systems/combat";

/** One button per target priority; the active one is pressed. */
const priorityControl = (tower: Tower) => {
  const active = tower.priority ?? "first";
  return `<div class="target-priority" role="group" aria-label="Target priority (T cycles)"><span>Target</span>${TARGET_PRIORITIES.map(
    (p) => `<button data-priority="${p}" class="${p === active ? "active" : ""}" aria-pressed="${p === active}">${PRIORITY_LABELS[p]}</button>`,
  ).join("")}</div>`;
};

/** Attack parameters such as slowdown or chain jumps, generated from the attack module. */
const attackSummary = (type: TowerId, tower: Tower | undefined, content: ContentPack) =>
  describeAttack(resolveUpgrades(tower ?? { type, upgrades: [] }, content).attack)
    .map((row) => ` · ${row.label} <b>${statValue(row)}</b>`)
    .join("");
const targets = (layers: readonly UnitLayer[]) =>
  layers.length > 1 ? "Ground · Air" : layers[0] === "air" ? "Air only" : "Ground only";

export function towerDetails(
  type: TowerId,
  tower: Tower | undefined,
  towers: readonly Tower[],
  content: ContentPack = DEFAULT_CONTENT,
): string {
  const definition = content.towers[type];
  const support = definition.attack.kind === "aura";
  const path = tower && towerPath(tower, content);
  const pathUpgrades = definition.upgrades.filter((upgrade) => upgrade.path === path);
  const heading = tower
    ? support
      ? path
        ? `PATH ${pathUpgrades[0].label.toUpperCase()} · ${tower.upgrades.length} / ${pathUpgrades.length}`
        : "CHOOSE PATH"
      : `LEVEL ${towerLevel(tower, content)} / ${maxTowerLevel(type, content)}${path ? ` · ${(definition.visual.paths?.[path]?.name ?? path).toUpperCase()}` : ""}`
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
    const bonuses = auraBonuses(tower ?? { type, upgrades: [] }, content);
    const color = `#${towerColor(tower ?? { type, upgrades: [] }, content).toString(16).padStart(6, "0")}`;
    const stat = (key: keyof typeof bonuses, label: string) =>
      `<div class="${bonuses[key] ? "active" : "inactive"}"><strong>${percent(bonuses[key])}</strong><span>${label}</span></div>`;
    values = `<div class="tower-stats aura-stats" style="--path-color:${color}">
      ${stat("damage", "Damage")}${stat("speed", "Attack speed")}${stat("range", "Range")}
    </div><p class="aura-summary">Aura radius: <b>${number(definition.range)} cells</b>${tower ? ` · <b>${towers.filter((target) => isInAura(tower, target, content)).length}</b> ${towers.filter((target) => isInAura(tower, target, content)).length === 1 ? "tower" : "towers"} supported` : ""}</p>
    <p class="aura-rule">Each Aura boosts exactly one stat. For each stat the strongest bonus counts; to get several bonuses, overlap Auras with different paths.</p>`;
  } else {
    const base = resolveUpgrades(tower ?? { type, upgrades: [] }, content).stats;
    const stats = tower
      ? effectiveTowerStats(tower, towers, content)
      : { ...base, base, bonuses: { damage: 0, speed: 0, range: 0 } };
    values = `<div class="tower-stats">
      <div><strong>${number(stats.damage)}</strong><span>Damage</span>${stats.bonuses.damage ? `<small class="aura-stat-detail">${number(base.damage)} + ${number(stats.damage - base.damage)} Aura</small>` : ""}</div>
      <div><strong>${number(stats.range)}</strong><span>Range</span>${stats.bonuses.range ? `<small class="aura-stat-detail">${number(base.range)} + ${number(stats.range - base.range)} Aura</small>` : ""}</div>
      <div><strong>${number(stats.interval)} s</strong><span>Fire interval</span>${stats.bonuses.speed ? `<small class="aura-stat-detail">${percent(stats.bonuses.speed)} speed · Aura</small>` : ""}</div>
    </div>`;
  }
  const cancelLabel = tower ? "Deselect (Esc)" : "Exit build mode (Esc)";
  return `<div class="selection-heading"><span>${tower ? "TOWER SELECTED" : "BUILD MODE"}</span><span class="selection-actions"><b>${heading}</b><button id="cancel-selection" class="cancel-selection" title="${cancelLabel}" aria-label="${cancelLabel}">✕</button></span></div>
    <p>${definition.description}</p>${isSupport(definition.attack) ? "" : `<p class="tower-targets">Targets: <b>${targets(definition.targets)}</b>${attackSummary(type, tower, content)}</p>`}${values}
    ${tower ? `${isSupport(definition.attack) ? "" : priorityControl(tower)}${upgradeControl(tower, towers, content)}<button id="sell-btn" class="sell">Sell · +${sellValue(tower)} credits</button>` : `<div class="placement-note">${definition.placement === "path" ? "Click a free path cell: the trap triggers when ground enemies walk over it." : "Click a free cell to build."}<br><span>Esc, ✕ or right-click exits build mode. Shift+click builds several.</span></div>`}`;
}
