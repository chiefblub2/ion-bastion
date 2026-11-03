import { DEFAULT_CONTENT } from "../content";
import { sellValue } from "../core/game";
import type { ContentPack, GameState, Tower } from "../core/types";
import { isSpecialization, maxTowerLevel, towerLevel, towerPath, towerTrack, upgradeOptions } from "../core/upgrades";
import { isSupport } from "../systems/attacks";
import { TARGET_PRIORITIES } from "../systems/combat";
import { discountedCost, upgradeDiscount } from "../systems/workshop";
import { escape, number } from "./format";
import { PRIORITY_LABELS } from "./messages";
import { upgradeChanges, type UpgradeChange } from "./upgrade-tooltip";
// The action card beside a selected tower: upgrade (or the path choice), target priority and sell.
// Pure HTML from the state; `tower-card-view.ts` shows and places it, `app/input.ts` handles its buttons.
/**
 * The tower the card is about: the selected one while it exists and the mission still runs. `over`: a versus
 * match has a result while this field may still be running; the result overlay then owns the board.
 */
export function cardTower(state: GameState, selected: number | null, over = false): Tower | undefined {
  if (over || selected === null || state.status === "won" || state.status === "lost") return undefined;
  return state.towers.find((t) => t.id === selected);
}
export interface CardChoice {
  id: string;
  label: string;
  /** Role of a specialization path or the bonus of an Aura track; empty for a plain level. */
  detail: string;
  /** Price after the Workshop discount. */
  price: number;
  disabled: boolean;
  /** Specialization tiers only: the tier's effect sentence and the values it changes; empty otherwise. */
  description: string;
  changes: UpgradeChange[];
  /** Specialization tiers only: the path colour. */
  color?: number;
}
/** The upgrades on offer right now: the next level, or every path of a choice. */
export function cardChoices(tower: Tower, towers: readonly Tower[], credits: number, content: ContentPack = DEFAULT_CONTENT): CardChoice[] {
  const definition = content.towers[tower.type],
    discount = upgradeDiscount(tower, towers, content);
  return upgradeOptions(tower, Infinity, content)
    .filter((o) => o.status === "available")
    .map(({ definition: u }) => {
      const upgrade = u!,
        aura = Object.entries(upgrade.effects.aura ?? {})[0],
        price = discountedCost(upgrade.cost, discount);
      // Plain levels read "Upgrade → Lv n"; Aura's tracks and every path tier keep their own names.
      const label = !upgrade.path && !upgrade.track && upgrade.effects.level !== undefined ? `Upgrade → Lv ${upgrade.effects.level}` : upgrade.label;
      const detail = isSpecialization(upgrade)
        ? (definition.visual.paths?.[upgrade.path!]?.role ?? "")
        : aura
          ? `+${number(aura[1] * 100)}% ${aura[0]}`
          : "";
      const special = isSpecialization(upgrade);
      return {
        id: upgrade.id,
        label,
        detail,
        price,
        disabled: credits < price,
        description: special ? upgrade.description : "",
        changes: special ? upgradeChanges(tower, towers, upgrade, content) : [],
        color: special ? definition.visual.paths?.[upgrade.path!]?.color : undefined,
      };
    });
}
export interface CardOptions {
  credits: number;
  /** Phone variant: one line per choice and a single cycling target button. */
  slim: boolean;
  /** Another co-op player's tower: shown, but every action is disabled. */
  owner?: string;
}
export function towerCardHtml(tower: Tower, towers: readonly Tower[], options: CardOptions, content: ContentPack = DEFAULT_CONTENT): string {
  const definition = content.towers[tower.type],
    locked = options.owner ? " disabled" : "";
  const sub = definition.attack.kind === "aura" ? auraSub(tower, content) : `Lv ${towerLevel(tower, content)}/${maxTowerLevel(tower.type, content)}`;
  const choices = cardChoices(tower, towers, options.credits, content);
  const upgrades = choices.length
    ? choices
        .map((c) => {
          const locked = c.disabled || options.owner ? " disabled" : "";
          if (c.description && !options.slim) {
            const color = c.color === undefined ? "" : ` style="--path-color:#${c.color.toString(16).padStart(6, "0")}"`;
            return `<button class="card-upgrade card-spec" data-upgrade="${c.id}"${color}${locked}><span class="card-spec-head"><span>${escape(c.label)}<small>${escape(c.detail)}</small></span><b>◇ ${c.price}</b></span><span class="card-spec-text">${escape(c.description)}</span>${
              c.changes.length ? `<span class="card-spec-changes">${c.changes.map(changeLine).join("")}</span>` : ""
            }</button>`;
          }
          const detail = c.detail && !options.slim ? `<small>${escape(c.detail)}</small>` : "";
          const tip = options.slim ? [c.detail, c.description, ...c.changes.map(changeText)].filter(Boolean).join("\n") : "";
          const title = tip ? ` title="${escape(tip)}"` : "";
          return `<button class="card-upgrade" data-upgrade="${c.id}"${title}${locked}><span>${escape(c.label)}${detail}</span><b>◇ ${c.price}</b></button>`;
        })
        .join("")
    : '<button class="card-upgrade" disabled>Max level</button>';
  const active = tower.priority ?? "first";
  // Support towers and traps have no target priority to choose.
  const target = isSupport(definition.attack) || definition.placement === "path"
    ? ""
    : options.slim
      ? `<button class="card-target" data-priority-cycle${locked}>Target: ${PRIORITY_LABELS[active]} ⟳</button>`
      : `<div class="card-priority" role="group" aria-label="Target priority">${TARGET_PRIORITIES.map(
          (p) => `<button data-priority="${p}" class="${p === active ? "active" : ""}" aria-pressed="${p === active}"${locked}>${PRIORITY_LABELS[p]}</button>`,
        ).join("")}</div>`;
  return `<div class="card-head"><strong>${escape(definition.name)}</strong> <span>${sub}</span><button class="card-close" data-deselect aria-label="Deselect (Esc)">✕</button></div>${
    options.owner ? `<p class="card-owner">Owned by ${escape(options.owner)}</p>` : ""
  }<div class="card-upgrades">${upgrades}</div>${target}<button class="card-sell" data-sell${locked}>Sell · ◇ ${sellValue(tower)}</button>`;
}

/** Aura: first a track, then (after any track's tier III) a path; the newest tier names where it stands. */
function auraSub(tower: Tower, content: ContentPack) {
  const definition = content.towers[tower.type],
    owned = definition.upgrades.filter((u) => tower.upgrades.includes(u.id)),
    newest = owned.reduce<(typeof owned)[number] | undefined>((best, u) => ((u.effects.level ?? 0) > (best?.effects.level ?? 0) ? u : best), undefined),
    level = `Lv ${towerLevel(tower, content)}/${maxTowerLevel(tower.type, content)}`;
  if (!towerTrack(tower, content)) return "Choose track";
  if (!towerPath(tower, content) && upgradeOptions(tower, Infinity, content).some((o) => o.status === "available" && o.definition!.path))
    return `${escape(newest!.label)} · Choose path`;
  return `${escape(newest!.label)} · ${level}`;
}

const changeText = (c: UpgradeChange) => `${c.label}: ${c.before === undefined ? "–" : `${number(c.before)}${c.unit}`} → ${number(c.after)}${c.unit}`;
const changeLine = (c: UpgradeChange) =>
  `<span>${escape(c.label)}</span><span>${c.before === undefined ? "–" : `${number(c.before)}${c.unit}`} → <b>${number(c.after)}${c.unit}</b></span>`;
