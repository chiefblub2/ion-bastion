import { DEFAULT_CONTENT } from "../content";
import { sellValue } from "../core/game";
import type { ContentPack, GameState, Tower, UpgradeDefinition } from "../core/types";
import { maxTowerLevel, towerLevel, towerPath, towerTrack, upgradeOptions } from "../core/upgrades";
import { effectiveTowerStats } from "../systems/auras";
import { isSupport } from "../systems/attacks";
import { TARGET_PRIORITIES } from "../systems/combat";
import { discountedCost, upgradeDiscount } from "../systems/workshop";
import { escape, number } from "./format";
import { PRIORITY_LABELS } from "./messages";
import { towerBranches } from "./tower-branches";
import { changeText, upgradeChanges, type UpgradeChange } from "./upgrade-changes";
// The action card beside a selected tower: the only place to upgrade (or choose a path), retarget and sell.
// Pure HTML from the state; `tower-card-view.ts` shows and places it, `app/game-input.ts` handles its buttons.
/**
 * The tower the card is about: the selected one while it exists and the mission still runs. `over`: a versus
 * match has a result while this field may still be running; the result overlay then owns the board.
 */
export function cardTower(state: GameState, selected: number | null, over = false): Tower | undefined {
  if (over || selected === null || state.status === "won" || state.status === "lost") return undefined;
  return state.towers.find((t) => t.id === selected);
}
export const NUMERALS = ["I", "II", "III", "IV", "V"] as const;
/** A path or track whose tier I a choice buys, with every tier's price (after the Workshop discount). */
export interface CardBranch {
  kind: "path" | "track";
  name: string;
  tiers: { numeral: string; price: number }[];
  /** Sum of the tier prices. */
  total: number;
}
export interface CardChoice {
  id: string;
  /** "Upgrade → Lv n" for a plain level, the branch's name at a choice, else the tier's own label ("Ricochet II"). */
  label: string;
  /** Role of a specialization path or the bonus of an Aura track tier ("+25%"); empty for a plain level. */
  detail: string;
  /** Price after the Workshop discount. */
  price: number;
  /** Price before the Workshop discount. */
  listPrice: number;
  disabled: boolean;
  /** Path and track tiers: the tier's effect sentence; empty for a plain level. */
  description: string;
  /** Every value the purchase changes. */
  changes: UpgradeChange[];
  /** Path and track tiers: the branch colour. */
  color?: number;
  /** Set when this choice starts a path or track. */
  branch?: CardBranch;
}
/** The upgrades on offer right now: the next level, or every path (or Aura track) of a choice. */
export function cardChoices(tower: Tower, towers: readonly Tower[], credits: number, content: ContentPack = DEFAULT_CONTENT): CardChoice[] {
  const definition = content.towers[tower.type],
    discount = upgradeDiscount(tower, towers, content),
    branches = towerBranches(definition),
    path = towerPath(tower, content),
    track = towerTrack(tower, content);
  return upgradeOptions(tower, Infinity, content)
    .filter((o) => o.status === "available")
    .map(({ definition: u }) => {
      const upgrade = u!,
        aura = Object.entries(upgrade.effects.aura ?? {})[0],
        price = discountedCost(upgrade.cost, discount),
        look = upgrade.path ? definition.visual.paths?.[upgrade.path] : upgrade.track ? definition.visual.tracks?.[upgrade.track] : undefined,
        starts = (upgrade.path && !path) || (upgrade.track && !track),
        found = starts ? (upgrade.path ? branches.paths.find((b) => b.id === upgrade.path) : branches.tracks.find((b) => b.id === upgrade.track)) : undefined,
        tiers = found?.tiers.map((tier, i) => ({ numeral: NUMERALS[i], price: discountedCost(tier.cost, discount) }));
      const plain = !upgrade.path && !upgrade.track;
      return {
        id: upgrade.id,
        label: found ? found.name : plain && upgrade.effects.level !== undefined ? `Upgrade → Lv ${upgrade.effects.level}` : upgrade.label,
        detail: upgrade.path ? (look?.role ?? "") : aura ? `+${number(aura[1] * 100)}%` : "",
        price,
        listPrice: upgrade.cost,
        disabled: credits < price,
        description: plain ? "" : upgrade.description,
        changes: upgradeChanges(tower, towers, upgrade, content),
        color: look?.color,
        ...(found && tiers ? { branch: { kind: found.kind, name: found.name, tiers, total: tiers.reduce((sum, t) => sum + t.price, 0) } } : {}),
      };
    });
}
/** The sentence above a path or track choice; only when there is more than one branch to choose from. */
export function choiceRule(choices: readonly CardChoice[]): string {
  const branches = choices.filter((c) => c.branch);
  if (branches.length < 2) return "";
  const kind = branches[0].branch!.kind,
    others = branches.length - 1;
  return `Choose one ${kind}. ${others === 1 ? "The other one locks" : `The other ${others === 2 ? "two" : others} lock`} for this tower.`;
}
/**
 * The card's header sub-line: "Lv 3/8"; "Lv 5/8 · Choose path" at a choice; "Lv 6/8 · Ricochet I/III" on a path, in
 * its colour. Aura: "Lv 1/7 · Choose track", "Lv 3/7 · Damage II/III", then "… · Choose path" and its path.
 */
export function cardSub(tower: Tower, content: ContentPack = DEFAULT_CONTENT): { text: string; color?: number } {
  const definition = content.towers[tower.type],
    level = `Lv ${towerLevel(tower, content)}/${maxTowerLevel(tower.type, content)}`,
    branches = towerBranches(definition),
    path = towerPath(tower, content),
    track = towerTrack(tower, content),
    open = upgradeOptions(tower, Infinity, content).filter((o) => o.status === "available").map((o) => o.definition!);
  const progress = (branch: ReturnType<typeof towerBranches>["paths"][number]) => {
    const owned = branch.tiers.filter((t) => tower.upgrades.includes(t.id)).length;
    return `${branch.name} ${NUMERALS[owned - 1]}/${NUMERALS[branch.tiers.length - 1]}`;
  };
  if (path) {
    const branch = branches.paths.find((b) => b.id === path)!;
    return { text: `${level} · ${progress(branch)}`, color: definition.visual.paths?.[path]?.color };
  }
  const choosing = (key: "path" | "track") => open.filter((u: UpgradeDefinition) => u[key]).length > 1;
  if (definition.attack.kind === "aura" || branches.tracks.length) {
    if (!track) return { text: choosing("track") ? `${level} · Choose track` : level };
    const branch = branches.tracks.find((b) => b.id === track)!;
    return { text: `${level} · ${progress(branch)}${choosing("path") ? " · Choose path" : ""}`, color: definition.visual.tracks?.[track]?.color };
  }
  return { text: choosing("path") ? `${level} · Choose path` : level };
}
export interface CardOptions {
  credits: number;
  /** Phone variant: compact lines, the path choice as an accordion and a single cycling target button. */
  slim: boolean;
  /** Another co-op player's tower: shown, but every action is disabled. */
  owner?: string;
  /** Slim card: the id of the choice whose details are open (the view's state). */
  open?: string;
}
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const colorStyle = (c: CardChoice) => (c.color === undefined ? "" : ` style="--path-color:${hex(c.color)}"`);
/** The price, with the list price struck through beside it under a Workshop discount. */
const priceHtml = (c: CardChoice) => `${c.listPrice !== c.price ? `<s>◇ ${number(c.listPrice)}</s> ` : ""}◇ ${number(c.price)}`;
const tiersLine = (b: CardBranch) =>
  `<span class="card-tiers">${b.tiers.map((t) => `${t.numeral} ◇${number(t.price)}`).join(" · ")} · all ◇${number(b.total)}</span>`;
const changesGrid = (changes: readonly UpgradeChange[]) =>
  changes.length
    ? `<span class="card-changes">${changes
        .map((c) => `<span>${escape(c.label)}</span><span>${c.before === undefined ? "–" : `${number(c.before)}${c.unit}`} → <b>${number(c.after)}${c.unit}</b></span>`)
        .join("")}</span>`
    : "";
const changesLine = (changes: readonly UpgradeChange[]) => (changes.length ? `<span class="card-changes-line">${escape(changes.map(changeText).join(" · "))}</span>` : "");
const labelHtml = (c: CardChoice) => `<span class="card-label">${escape(c.label)}${c.detail ? ` <small>${escape(c.detail)}</small>` : ""}</span>`;

export function towerCardHtml(tower: Tower, towers: readonly Tower[], options: CardOptions, content: ContentPack = DEFAULT_CONTENT): string {
  const definition = content.towers[tower.type],
    { slim } = options,
    locked = options.owner ? " disabled" : "";
  const sub = cardSub(tower, content);
  const choices = cardChoices(tower, towers, options.credits, content),
    rule = choiceRule(choices);
  const choice = (c: CardChoice) => {
    const buy = c.disabled || options.owner ? " disabled" : "",
      text = c.description ? `<span class="card-text">${escape(c.description)}</span>` : "",
      changes = slim ? changesLine(c.changes) : changesGrid(c.changes);
    if (c.branch && slim) {
      // The accordion: the head opens the option; only the open one shows its details and a buy button.
      const open = options.open === c.id;
      return `<div class="card-option${open ? " open" : ""}"${colorStyle(c)}><button class="card-option-head" data-card-open="${c.id}" aria-expanded="${open}">${labelHtml(c)}<b>${priceHtml(c)}</b></button>${
        open
          ? `<div class="card-option-body">${tiersLine(c.branch)}${text}${changes}<button class="card-upgrade card-buy" data-upgrade="${c.id}"${buy}>Choose ${escape(c.branch.name)} · ${priceHtml(c)}</button></div>`
          : ""
      }</div>`;
    }
    const spec = c.description ? " card-spec" : "";
    return `<button class="card-upgrade${spec}" data-upgrade="${c.id}"${colorStyle(c)}${buy}><span class="card-row">${labelHtml(c)}<b>${priceHtml(c)}</b></span>${
      c.branch ? tiersLine(c.branch) : ""
    }${slim ? "" : text}${changes}</button>`;
  };
  const boosted = !slim && choices.some((c) => c.changes.length) && Object.values(effectiveTowerStats(tower, towers, content).bonuses).some(Boolean);
  const upgrades = choices.length
    ? `${rule ? `<p class="card-rule">${rule}</p>` : ""}${choices.map(choice).join("")}${boosted ? '<p class="card-note">Values include Aura bonuses.</p>' : ""}`
    : '<button class="card-upgrade" disabled>Max level</button>';
  const active = tower.priority ?? "first";
  // Support towers and traps have no target priority to choose.
  const target =
    isSupport(definition.attack) || definition.placement === "path"
      ? ""
      : slim
        ? `<button class="card-target" data-priority-cycle${locked}>Target: ${PRIORITY_LABELS[active]} ⟳</button>`
        : `<div class="card-priority" role="group" aria-label="Target priority (T cycles)">${TARGET_PRIORITIES.map(
            (p) => `<button data-priority="${p}" class="${p === active ? "active" : ""}" aria-pressed="${p === active}"${locked}>${PRIORITY_LABELS[p]}</button>`,
          ).join("")}</div>`;
  const subStyle = sub.color === undefined ? "" : ` style="color:${hex(sub.color)}"`;
  return `<div class="card-head"><strong>${escape(definition.name)}</strong><button class="card-close" data-deselect aria-label="Deselect (Esc)">✕</button><span class="card-sub"${subStyle}>${escape(sub.text)}</span></div>${
    options.owner ? `<p class="card-owner">Owned by ${escape(options.owner)}</p>` : ""
  }<div class="card-upgrades">${upgrades}</div><div class="card-foot">${target}<button class="card-sell" data-sell${locked}>Sell · ◇ ${number(sellValue(tower, towers, content))}</button></div>`;
}
