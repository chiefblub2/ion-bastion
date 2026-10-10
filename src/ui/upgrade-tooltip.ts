import { DEFAULT_CONTENT } from "../content";
import type { ContentPack, Tower, TowerDefinition } from "../core/types";
import { AURA_STATS, auraBonuses, effectiveTowerStats } from "../systems/auras";
import { describeAttack } from "../systems/attacks";
import { previewUpgrade, resolveUpgrades, upgradeOptions, towerLevel } from "../core/upgrades";
import { escape, number, statValue } from "./format";

const row = (label: string, before: number, after: number, unit = "") =>
  `<div class="upgrade-change"><span>${label}</span><span class="upgrade-before">${number(before)}${unit}</span><span aria-label="becomes">→</span><strong>${number(after)}${unit}</strong></div>`;

/** Inline accent for path upgrades, taken from the tower's path visuals. */
const pathColorFor = (definition: TowerDefinition) => (path?: string) => {
  const color = path ? definition.visual.paths?.[path]?.color : undefined;
  return color === undefined ? "" : ` style="--path-color:#${color.toString(16).padStart(6, "0")}"`;
};

/** Both tower categories render the same catalog, purchase attributes and preview. */
export function upgradeControl(tower: Tower, towers: readonly Tower[] = [], content: ContentPack = DEFAULT_CONTENT): string {
  const definition = content.towers[tower.type];
  const support = definition.attack.kind === "aura";
  const pathColor = pathColorFor(definition);
  const all = upgradeOptions(tower, Infinity, content);
  // Support towers keep their newest purchase per track visible; earlier tiers are superseded.
  const hidden = (option: (typeof all)[number]) => option.status === "locked" || option.status === "excluded";
  const superseded = new Set(all.filter(option => !hidden(option)).flatMap(option => option.definition!.requires));
  const options = all.filter(option =>
    !hidden(option) && (option.status !== "purchased" || (support && !superseded.has(option.definition!.id))));
  if (!options.length) return '<button class="upgrade" disabled>Max level</button>';
  return `<div class="upgrade-options ${support ? "aura-upgrades" : ""}">${options.map(option => {
    const upgrade = option.definition!;
    const purchased = option.status === "purchased";
    const projected = previewUpgrade(tower, upgrade.id, content);
    const nextTower = projected ?? tower;
    // Substitute the projected source too, so previews never mutate live towers.
    const nextTowers = towers.map(candidate => candidate.id === tower.id ? nextTower : candidate);
    const current = effectiveTowerStats(tower, towers, content);
    const next = effectiveTowerStats(nextTower, nextTowers, content);
    const currentAura = auraBonuses(tower, content), nextAura = auraBonuses(nextTower, content);
    const changedAttack = Object.keys(upgrade.effects.attack ?? {});
    const attackBefore = describeAttack(resolveUpgrades(tower, content).attack, changedAttack);
    const attackAfter = describeAttack(resolveUpgrades(nextTower, content).attack, changedAttack);
    const changes = [
      ...(["damage", "range", "interval"] as const).filter(key => upgrade.effects.stats?.[key] !== undefined).map(key =>
        row(({damage: "Damage", range: "Range", interval: "Fire interval"})[key], current[key], next[key], key === "interval" ? " s" : "")),
      ...attackBefore.map((before, i) => row(before.label, before.value, attackAfter[i].value, before.unit)),
      ...AURA_STATS.filter(key => upgrade.effects.aura?.[key] !== undefined).map(key =>
        row(({damage: "Damage", speed: "Attack speed", range: "Range"})[key], currentAura[key] * 100, nextAura[key] * 100, "%")),
    ].join("");
    const auraKey = AURA_STATS.find(key => upgrade.effects.aura?.[key] !== undefined);
    const summary = auraKey
      ? purchased ? `+${number(currentAura[auraKey] * 100)}% active` : `+${number(currentAura[auraKey] * 100)}% → +${number(nextAura[auraKey] * 100)}%`
      : "";
    const title = upgrade.effects.level !== undefined
      ? `Level ${towerLevel(tower, content)} → ${towerLevel(nextTower, content)}`
      : `${escape(upgrade.label)}${purchased ? " · active" : ""}`;
    const tooltipId = `upgrade-tooltip-${upgrade.id}`;
    const unchanged = describeAttack(resolveUpgrades(tower, content).attack).filter(r => !changedAttack.includes(r.key));
    const special = support
      ? `${tower.upgrades.length ? "" : "The first purchase sets the path; the other paths are locked. "}The Aura radius stays at ${number(current.range)} cells. Only the strongest Aura bonus applies per stat.`
      : unchanged.length ? `Unchanged: ${unchanged.map(r => `${r.label} ${statValue(r)}`).join(", ")}.` : "";
    return `<div class="upgrade-control">
      <button class="upgrade ${support ? "aura-upgrade" : ""}" data-upgrade="${upgrade.id}"${pathColor(upgrade.path)} aria-describedby="${tooltipId}" ${purchased ? "disabled" : ""}>
        ${support ? `<span>${escape(upgrade.label)}<small>${summary}</small></span><b>${purchased ? "✓" : `◇ ${upgrade.cost}`}</b>` : `${upgrade.effects.level !== undefined ? "Upgrade" : escape(upgrade.label)} · ◇ ${upgrade.cost}`}
      </button>
      <button class="upgrade-info" aria-label="Explain ${escape(upgrade.label)}" aria-controls="${tooltipId}" aria-expanded="false" aria-describedby="${tooltipId}">ⓘ</button>
      <div id="${tooltipId}" class="upgrade-tooltip" role="tooltip" hidden>
        <strong class="upgrade-tooltip-title">${title}</strong>${changes}
        <p>${escape(upgrade.description)}</p>
        ${special ? `<p class="upgrade-unchanged">${special}</p>` : ""}
        ${Object.values(current.bonuses).some(Boolean) ? '<p class="upgrade-unchanged">Active Aura bonuses are included in both values.</p>' : ""}
      </div>
    </div>`;
  }).join("")}</div>`;
}

/** Shared hover/focus preview plus a separate touch target that never buys an upgrade. */
export function bindUpgradeTooltip() {
  const wrapper = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(".upgrade-control") : null;
  const setOpen = (control: HTMLElement, open: boolean) => {
    if (open) {
      document.querySelectorAll<HTMLElement>(".upgrade-control").forEach((other) => {
        if (other === control) return;
        const otherTip = other.querySelector<HTMLElement>(".upgrade-tooltip");
        if (otherTip) otherTip.hidden = true;
        other.querySelector(".upgrade-info")?.setAttribute("aria-expanded", "false");
        delete other.dataset.pinned;
      });
    }
    const tip = control.querySelector<HTMLElement>(".upgrade-tooltip");
    if (tip) tip.hidden = !open;
    control.querySelector(".upgrade-info")?.setAttribute("aria-expanded", String(open));
    if (!open) delete control.dataset.pinned;
  };
  document.addEventListener("pointerover", (event) => {
    const control = wrapper(event.target);
    if (event.pointerType !== "touch" && control && !control.contains(event.relatedTarget as Node | null))
      setOpen(control, true);
  });
  document.addEventListener("pointerout", (event) => {
    const control = wrapper(event.target);
    if (control && !control.contains(event.relatedTarget as Node | null) && !control.dataset.pinned && !control.contains(document.activeElement))
      setOpen(control, false);
  });
  document.addEventListener("focusin", (event) => {
    const control = wrapper(event.target);
    if (control) setOpen(control, true);
  });
  document.addEventListener("focusout", (event) => {
    const control = wrapper(event.target);
    if (control && !control.contains(event.relatedTarget as Node | null)) setOpen(control, false);
  });
  document.addEventListener("click", (event) => {
    const control = wrapper(event.target);
    if (control && event.target instanceof Element && event.target.closest(".upgrade-info")) {
      const open = !control.dataset.pinned;
      setOpen(control, open);
      if (open) control.dataset.pinned = "true";
    } else if (!control) {
      document.querySelectorAll<HTMLElement>(".upgrade-control").forEach((element) => setOpen(element, false));
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = document.querySelector<HTMLElement>(".upgrade-tooltip:not([hidden])");
    if (!open) return;
    setOpen(open.closest<HTMLElement>(".upgrade-control")!, false);
    event.preventDefault();
    event.stopImmediatePropagation();
  });
}
