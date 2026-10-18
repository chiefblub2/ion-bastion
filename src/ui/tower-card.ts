import { DEFAULT_CONTENT } from "../content";
import { sellValue } from "../core/game";
import type { ContentPack, GameState, Tower } from "../core/types";
import { isSpecialization, maxTowerLevel, towerLevel, towerPath, upgradeOptions } from "../core/upgrades";
import { isSupport } from "../systems/attacks";
import { TARGET_PRIORITIES } from "../systems/combat";
import { discountedCost, upgradeDiscount } from "../systems/workshop";
import { escape, number } from "./format";
import { PRIORITY_LABELS } from "./messages";
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
  /** Role of a specialization path or the bonus of an Aura path; empty for a plain level. */
  detail: string;
  /** Price after the Workshop discount. */
  price: number;
  disabled: boolean;
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
      const label = !upgrade.path && upgrade.effects.level !== undefined ? `Upgrade → Lv ${upgrade.effects.level}` : upgrade.label;
      const detail = isSpecialization(upgrade)
        ? (definition.visual.paths?.[upgrade.path!]?.role ?? "")
        : aura
          ? `+${number(aura[1] * 100)}% ${aura[0]}`
          : "";
      return { id: upgrade.id, label, detail, price, disabled: credits < price };
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
    locked = options.owner ? " disabled" : "",
    path = towerPath(tower, content);
  const sub =
    definition.attack.kind === "aura"
      ? path
        ? escape(definition.upgrades.find((u) => u.path === path)!.label)
        : "Choose path"
      : `Lv ${towerLevel(tower, content)}/${maxTowerLevel(tower.type, content)}`;
  const choices = cardChoices(tower, towers, options.credits, content);
  const upgrades = choices.length
    ? choices
        .map((c) => {
          const detail = c.detail && !options.slim ? `<small>${escape(c.detail)}</small>` : "";
          const title = c.detail && options.slim ? ` title="${escape(c.detail)}"` : "";
          return `<button class="card-upgrade" data-upgrade="${c.id}"${title}${c.disabled || options.owner ? " disabled" : ""}><span>${escape(c.label)}${detail}</span><b>◇ ${c.price}</b></button>`;
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
