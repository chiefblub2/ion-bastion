import type { Enemy, Sim } from "../core/types";
import { statusFlags, type StatusFlags } from "../systems/status";
import { markFactor } from "../systems/support";
import { traitFlags } from "../systems/traits";
import { escape, number } from "./format";
import { playerName } from "./players";
import { enemyIcon, LAYER, traitTag } from "./wave-forecast";

const STATUS_LABELS: { [K in keyof StatusFlags]: string } = {
  slowed: "SLOWED",
  stunned: "STUNNED",
  burning: "BURNING",
  vulnerable: "VULNERABLE",
  pulled: "PULLED BACK",
  disrupted: "DISRUPTED",
  netted: "NETTED",
  bleeding: "BLEEDING",
  charged: "CHARGED",
};

/** Changes whenever the panel's content would; avoids rewriting the HTML on every refresh. */
export function enemyKey(sim: Sim, e: Enemy): string {
  const status = statusFlags(e, sim.state.time),
    traits = traitFlags(sim, e);
  return JSON.stringify([e.id, Math.ceil(e.hp), Math.ceil(e.shield ?? 0), status, traits.sprinting, traits.revealed, markFactor(sim, e)]);
}

/** Sidebar panel for a selected enemy: live HP, shield, base values, traits and active status effects. */
export function enemyDetails(sim: Sim, e: Enemy): string {
  const d = sim.content.enemies[e.type],
    traits = traitFlags(sim, e),
    status = statusFlags(e, sim.state.time),
    hp = Math.max(0, Math.ceil(e.hp)),
    share = Math.max(0, Math.min(1, e.hp / e.maxHp));
  const tags = [
    ...(d.layer === "air" ? [{ kind: "air", label: "AIR", title: "Flies: only towers that can target air can hit it" }] : []),
    ...(d.traits ?? []).map((t) => traitTag(t, sim.content)),
  ]
    .map((t) => `<em class="unit-tag ${t.kind === "air" ? "air" : `trait ${t.kind}`}" title="${escape(t.title)}">${escape(t.label)}</em>`)
    .join("");
  const states = [
    ...(Object.keys(STATUS_LABELS) as (keyof StatusFlags)[]).filter((k) => status[k]).map((k) => STATUS_LABELS[k]),
    ...(traits.sprinting ? ["SPRINTING"] : []),
    ...(traits.stealth && traits.revealed ? ["REVEALED"] : []),
    ...(markFactor(sim, e) > 1 ? ["MARKED"] : []),
  ]
    .map((label) => `<em class="unit-tag status">${label}</em>`)
    .join("");
  const shield = e.shield && e.shield > 0 ? ` · Shield <b>${number(Math.ceil(e.shield))}</b>` : "";
  const label = "Deselect (Esc)";
  return `<div class="selection-heading"><span>ENEMY SELECTED</span><span class="selection-actions"><b>${enemyIcon(d.visual, d.color)} ${escape(d.name)}</b><button id="cancel-selection" class="cancel-selection" title="${label}" aria-label="${label}">✕</button></span></div>
    <div class="enemy-hp" role="meter" aria-label="Hit points" aria-valuemin="0" aria-valuemax="${Math.ceil(e.maxHp)}" aria-valuenow="${hp}"><span style="width:${(share * 100).toFixed(1)}%"></span></div>
    <p class="enemy-hp-text">♡ <b>${number(hp)}</b> / ${number(Math.ceil(e.maxHp))} HP${shield}</p>
    <div class="tower-stats">
      <div><strong>${number(d.speed)}</strong><span>Cells/s</span></div>
      <div><strong>◇ ${number(e.sentBy === undefined ? d.reward : 0)}</strong><span>Reward</span></div>
      <div><strong>${number(d.leak)}</strong><span>Reactor damage</span></div>
    </div>
    <p class="enemy-meta">${LAYER[d.layer]}${e.sentBy !== undefined ? ` · sent by <b>${playerName(e.sentBy)}</b>` : ""}</p>
    ${tags ? `<div class="enemy-tags">${tags}</div>` : ""}${states ? `<div class="enemy-tags">${states}</div>` : ""}`;
}
