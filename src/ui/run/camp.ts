// Camps: the shop or forge, the repair, an event, and the roster tower a shop item applies to.
import type { TowerId } from "../../core/types";
import { threatRules } from "../../run/ascension";
import { eventOf } from "../../run/events";
import { hasFlag, relicOf } from "../../run/relics";
import { doctrineCandidates, rankOfTower, rosterCap, type RunState, type ShopItem } from "../../run/run";
import { SHOP_TEXT } from "../../run/shop";
import { REINFORCE_NODE, REPAIR_NODE, XP_BOUGHT } from "../../run/tuning";
import { escape } from "../format";
import { towerIconHtml } from "../tower-codex";
import { KIND, page } from "./state";
import { rankHint, towerName } from "./pieces";
import { decisionHtml, doctrineDecision, emptyPreview, type Option, pendingDecision, relicPreview, takeButton, towerPreview } from "./decision";
/** A shop item as an option: its price, and why it cannot be bought when it cannot. */
function shopOption(r: RunState, item: ShopItem, i: number): Option {
  const name = item.relic ? relicOf(item.relic).name : item.tower ? towerName(item.tower) : SHOP_NAME[item.kind],
    icon = item.tower ? towerIconHtml(page.host.content.towers[item.tower]) : `<span class="run-glyph" aria-hidden="true">${item.relic ? relicOf(item.relic).icon : SHOP_ICON[item.kind]}</span>`;
  return {
    key: String(i),
    label: name,
    disabled: !!item.sold,
    html: `<span class="run-icon">${icon}</span><span class="run-option-text"><strong>${escape(name)}</strong><small>${item.sold ? "sold" : `◈ ${item.price}`}${!item.sold && r.scrap < item.price ? " · too dear" : ""}</small></span>`,
  };
}
const SHOP_NAME: Record<ShopItem["kind"], string> = { patch: "Reactor patch", funds: "Field funds", drill: "Drill", discount: "Prototype discount", relic: "Relic", tower: "Tower", doctrine: "Doctrine", xp: "Field drills" };
const SHOP_ICON: Record<ShopItem["kind"], string> = { patch: "✚", funds: "◇", drill: "⚙", discount: "%", relic: "◆", tower: "▲", doctrine: "✦", xp: "▮" };
/** Why a shop item cannot be bought now, or undefined. */
export function shopBlock(r: RunState, item: ShopItem) {
  if (item.sold) return "Sold.";
  if (r.scrap < item.price) return `Needs ◈ ${item.price}; you have ◈ ${r.scrap}.`;
  if (item.kind === "patch" && r.reactor >= r.reactorMax) return "The reactor is whole.";
  if (item.kind === "doctrine" && !doctrineCandidates(r, page.host.content).length) return "No roster tower can take a Doctrine.";
  return undefined;
}
function shopPreview(r: RunState, item: ShopItem) {
  const block = shopBlock(r, item),
    body = item.relic ? relicPreview(r, item.relic, "relics") : item.tower ? towerPreview(r, item.tower) : `<h3>${escape(SHOP_NAME[item.kind])}</h3><p>${escape(SHOP_TEXT[item.kind])}</p>`;
  return `${body}${item.tower && r.roster.length >= rosterCap(r) ? `<p class="run-decision-note">Your roster is full: it replaces a tower, and you see what that costs first.</p>` : ""}${block ? `<p class="run-downside">${escape(block)}</p>` : ""}`;
}
/** The camp of the node: a shop or forge to buy from, a repair to choose, or an event's choices; each as one decision. */
function campDecision(r: RunState) {
  const node = r.node!,
    k = KIND[node.kind];
  if (r.offers.shop) {
    const stock = r.offers.shop,
      i = page.selected === undefined ? -1 : Number(page.selected),
      item = stock[i];
    return decisionHtml({
      step: "shop",
      eyebrow: `${k.icon} ${k.label.toUpperCase()}`,
      title: node.kind === "forge" ? "Hone your towers" : "Spend your Scrap",
      options: stock.map((it, n) => shopOption(r, it, n)),
      preview: item ? shopPreview(r, item) : emptyPreview(`${k.note} Select an item to see what it does.`),
      actions: `<button class="quiet" data-run="continue">Leave</button>${takeButton(item && !shopBlock(r, item) ? `Buy ${item.relic ? relicOf(item.relic).name : item.tower ? towerName(item.tower) : SHOP_NAME[item.kind]} (◈ ${item.price})` : undefined)}`,
    });
  }
  if (r.offers.repair) {
    const zealot = hasFlag(r.relics, "zealot"),
      heal = zealot ? 0 : Math.round(REPAIR_NODE * threatRules(r.threat).repair),
      options: Option[] = [
        { key: "heal", label: "Repair", disabled: !heal || r.reactor >= r.reactorMax, html: `<span class="run-glyph" aria-hidden="true">✚</span><span class="run-option-text"><strong>Repair</strong><small>+${heal} reactor</small></span>` },
        { key: "reinforce", label: "Reinforce", html: `<span class="run-glyph" aria-hidden="true">⬢</span><span class="run-option-text"><strong>Reinforce</strong><small>+${REINFORCE_NODE} maximum</small></span>` },
      ],
      text: Record<string, string> = {
        heal: zealot ? "Zealot: camps no longer repair the reactor." : `Patch the reactor by ${heal} (${r.reactor}/${r.reactorMax} now), up to its maximum.`,
        reinforce: `The reactor holds ${REINFORCE_NODE} more energy for the rest of the run${zealot ? "" : `, and gains ${REINFORCE_NODE} now`}.`,
      };
    return decisionHtml({
      step: "repair",
      eyebrow: `${k.icon} ${k.label.toUpperCase()}`,
      title: "Tend the reactor",
      options,
      preview: page.selected && text[page.selected] ? `<h3>${page.selected === "heal" ? "Repair" : "Reinforce"}</h3><p>${escape(text[page.selected])}</p>` : emptyPreview(k.note),
      actions: takeButton(page.selected === "heal" ? "Repair the reactor" : page.selected === "reinforce" ? "Reinforce the reactor" : undefined, page.selected === "reinforce" || (page.selected === "heal" && !options[0].disabled)),
    });
  }
  const event = r.offers.event ? eventOf(r.offers.event) : undefined;
  if (event) {
    const choices = event.choices(r, page.host.content),
      c = page.selected === undefined ? undefined : choices[Number(page.selected)];
    return decisionHtml({
      step: "event",
      eyebrow: `${k.icon} EVENT`,
      title: escape(event.title),
      note: escape(event.text),
      options: choices.map((ch, i): Option => ({ key: String(i), label: ch.label, disabled: !ch.ok, html: `<span class="run-option-text"><strong>${escape(ch.label)}</strong></span>` })),
      preview: c ? `<h3>${escape(c.label)}</h3><p>${escape(c.detail)}</p>${c.ok ? "" : `<p class="run-downside">Not possible right now.</p>`}` : emptyPreview("Every choice shows its cost. Select one to see it."),
      actions: takeButton(c?.ok ? c.label : undefined),
    });
  }
  return `<section class="run-decision run-done"><header class="run-decision-head"><p class="choice-index">${k.icon} ${k.label.toUpperCase()}</p><h2 class="run-step-title">Nothing left here</h2></header><div class="run-row run-continue"><button class="primary" data-run="continue">Leave <span>→</span></button></div></section>`;
}
/** A shop item that applies to one roster tower: pick the tower, see the effect, confirm. */
function targetDecision(r: RunState) {
  const item = r.offers.shop![page.targeting!];
  if (item.kind === "doctrine") return doctrineDecision(r, "", "shop");
  const held = (id: TowerId) => item.kind !== "xp" && r.mods.some((m) => m.tower === id && m.kind === item.kind),
    pick = page.selected && r.roster.includes(page.selected as TowerId) && !held(page.selected as TowerId) ? (page.selected as TowerId) : undefined,
    options = r.roster.map((id): Option => ({
      key: id,
      label: towerName(id),
      disabled: held(id),
      html: `<span class="run-icon">${towerIconHtml(page.host.content.towers[id])}</span><span class="run-option-text"><strong>${escape(towerName(id))}</strong><small>${held(id) ? "has it" : `rank ${rankOfTower(r, id)}`}</small></span>`,
    })),
    effect = (id: TowerId) =>
      item.kind === "drill"
        ? `${towerName(id)}'s level 2 costs 1 credit for the rest of the run.`
        : item.kind === "discount"
          ? `${towerName(id)} costs 25% less (◇ ${Math.round(page.host.content.towers[id].cost * 0.75)} instead of ◇ ${page.host.content.towers[id].cost}) for the rest of the run.`
          : `${towerName(id)} gains ${XP_BOUGHT} rank XP. ${rankHint((r.ranks[id] ?? 0) + XP_BOUGHT)}`;
  return decisionHtml({
    step: "target",
    eyebrow: `${SHOP_NAME[item.kind].toUpperCase()} · ◈ ${item.price}`,
    title: "Choose the tower",
    options,
    preview: pick ? `<h3>${escape(towerName(pick))}</h3><p>${escape(effect(pick))}</p><p class="run-note">A replaced or retired tower takes its shop mods with it.</p>` : emptyPreview(escape(SHOP_TEXT[item.kind])),
    actions: `<button class="quiet" data-run="cancel">Cancel</button>${takeButton(pick && `Apply to ${towerName(pick)}`)}`,
  });
}
export function campHtml(r: RunState) {
  const decision = r.offers.event ? undefined : pendingDecision(r);
  if (decision) return decision;
  if (page.targeting !== undefined && r.offers.shop) return targetDecision(r);
  return campDecision(r);
}
