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
  return `<div class="target-priority" role="group" aria-label="Zielpriorität (T wechselt)"><span>Ziel</span>${TARGET_PRIORITIES.map(
    (p) => `<button data-priority="${p}" class="${p === active ? "active" : ""}" aria-pressed="${p === active}">${PRIORITY_LABELS[p]}</button>`,
  ).join("")}</div>`;
};

/** Attack parameters such as slowdown or chain jumps, generated from the attack module. */
const attackSummary = (type: TowerId, tower: Tower | undefined, content: ContentPack) =>
  describeAttack(resolveUpgrades(tower ?? { type, upgrades: [] }, content).attack)
    .map((row) => ` · ${row.label} <b>${statValue(row)}</b>`)
    .join("");
const targets = (layers: readonly UnitLayer[]) =>
  layers.length > 1 ? "Boden · Luft" : layers[0] === "air" ? "nur Luft" : "nur Boden";

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
        ? `PFAD ${pathUpgrades[0].label.toUpperCase()} · ${tower.upgrades.length} / ${pathUpgrades.length}`
        : "PFAD WÄHLEN"
      : `STUFE ${towerLevel(tower, content)} / ${maxTowerLevel(type, content)}`
    : definition.name;
  let values: string;
  const resolved = resolveUpgrades(tower ?? { type, upgrades: [] }, content),
    income = resolved.attack;
  if (income.kind === "detect") {
    values = `<div class="tower-stats income-stats">
      <div><strong>${number(resolved.stats.range)}</strong><span>Felder Scan-Radius</span></div>
    </div><p class="aura-summary">Getarnte Gegner in Reichweite können von allen Türmen anvisiert werden. Flächenschaden trifft sie auch ohne Detektor.</p>`;
  } else if (income.kind === "income") {
    values = `<div class="tower-stats income-stats">
      <div><strong>◇ ${income.amount}</strong><span>Credits pro Welle</span></div>
    </div><p class="aura-summary">Zahlt nach jeder abgeschlossenen Welle aus · Investition ◇ ${tower?.spent ?? definition.cost} ≙ <b>${Math.ceil((tower?.spent ?? definition.cost) / income.amount)}</b> Wellen Ertrag</p>`;
  } else if (support) {
    const bonuses = auraBonuses(tower ?? { type, upgrades: [] }, content);
    const color = `#${towerColor(tower ?? { type, upgrades: [] }, content).toString(16).padStart(6, "0")}`;
    const stat = (key: keyof typeof bonuses, label: string) =>
      `<div class="${bonuses[key] ? "active" : "inactive"}"><strong>${percent(bonuses[key])}</strong><span>${label}</span></div>`;
    values = `<div class="tower-stats aura-stats" style="--path-color:${color}">
      ${stat("damage", "Schaden")}${stat("speed", "Angriffstempo")}${stat("range", "Reichweite")}
    </div><p class="aura-summary">Aura-Radius: <b>${number(definition.range)} Felder</b>${tower ? ` · <b>${towers.filter((target) => isInAura(tower, target, content)).length}</b> Türme unterstützt` : ""}</p>
    <p class="aura-rule">Jede Aura verstärkt genau eine Eigenschaft. Pro Eigenschaft zählt der stärkste Bonus; für mehrere Boni lass Auren mit verschiedenen Pfaden überlappen.</p>`;
  } else {
    const base = resolveUpgrades(tower ?? { type, upgrades: [] }, content).stats;
    const stats = tower
      ? effectiveTowerStats(tower, towers, content)
      : { ...base, base, bonuses: { damage: 0, speed: 0, range: 0 } };
    values = `<div class="tower-stats">
      <div><strong>${number(stats.damage)}</strong><span>Schaden</span>${stats.bonuses.damage ? `<small class="aura-stat-detail">${number(base.damage)} + ${number(stats.damage - base.damage)} Aura</small>` : ""}</div>
      <div><strong>${number(stats.range)}</strong><span>Reichweite</span>${stats.bonuses.range ? `<small class="aura-stat-detail">${number(base.range)} + ${number(stats.range - base.range)} Aura</small>` : ""}</div>
      <div><strong>${number(stats.interval)} s</strong><span>Schusstakt</span>${stats.bonuses.speed ? `<small class="aura-stat-detail">${percent(stats.bonuses.speed)} Tempo · Aura</small>` : ""}</div>
    </div>`;
  }
  const cancelLabel = tower ? "Auswahl aufheben (Esc)" : "Baumodus beenden (Esc)";
  return `<div class="selection-heading"><span>${tower ? "TURM AUSGEWÄHLT" : "BAUMODUS"}</span><span class="selection-actions"><b>${heading}</b><button id="cancel-selection" class="cancel-selection" title="${cancelLabel}" aria-label="${cancelLabel}">✕</button></span></div>
    <p>${definition.description}</p>${isSupport(definition.attack) ? "" : `<p class="tower-targets">Ziele: <b>${targets(definition.targets)}</b>${attackSummary(type, tower, content)}</p>`}${values}
    ${tower ? `${isSupport(definition.attack) ? "" : priorityControl(tower)}${upgradeControl(tower, towers, content)}<button id="sell-btn" class="sell">Verkaufen · +${sellValue(tower)} Credits</button>` : '<div class="placement-note">Freies Feld anklicken zum Bauen.<br><span>Esc, ✕ oder Rechtsklick beendet den Baumodus. Shift+Klick baut mehrere.</span></div>'}`;
}
