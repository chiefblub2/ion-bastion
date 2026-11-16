// The Arsenal's detail panel for the selected tower: dossier, veterancy, the gear track, base values, what the tower
// grows into, and the one purchase button with its reason. HTML strings; `ui/arsenal-view.ts` places them.
import { type Arsenal, owns, veterancy } from "../../campaign/arsenal";
import { markDelta } from "../../campaign/gear";
import { CORE_KIT, MAX_MARK } from "../../content/arsenal";
import type { ContentPack, TowerId } from "../../core/types";
import { hex } from "../atlas/model";
import { escape, number } from "../format";
import { markPips, rankChevrons } from "../gear-badge";
import { ROMAN } from "../gear-text";
import { towerBranches, type TowerBranch } from "../tower-branches";
import { towerIconHtml } from "../tower-codex";
import { dossier, forgeBlock, type GearNode, gearNodes, researchBlock, veterancyOf } from "./model";

const colorOf = (c: number | string) => (typeof c === "number" ? hex(c) : c);
const pct = (n: number, of: number) => Math.max(0, Math.min(100, (100 * n) / of));

function nodeState(n: GearNode) {
  switch (n.state) {
    case "forged":
      return `<span class="ars-node-state">Forged</span>`;
    case "ready":
      return `<span class="ars-node-state"><b>${number(n.price)}</b> Salvage · ready</span>`;
    case "rank":
      return `<span class="ars-node-state">Rank ${n.rank} · <b>${number(n.missing.xp)}</b> XP to go</span>`;
    case "salvage":
      return `<span class="ars-node-state"><b>${number(n.missing.salvage)}</b> more Salvage</span>`;
    default:
      return `<span class="ars-node-state">Rank ${n.rank} · ${number(n.price)}</span>`;
  }
}

function trackHtml(a: Arsenal, id: TowerId, content: ContentPack, owned: boolean) {
  const nodes = gearNodes(a, id, content),
    next = nodes.find((n) => n.state !== "forged" && n.state !== "later"),
    forged = nodes.filter((n) => n.state === "forged").length;
  const rows = nodes
    .map((n) => {
      const sig = n.mark === MAX_MARK,
        body = sig && n.signature ? `<span class="ars-node-text"><b>${escape(n.signature)}</b> ${escape(n.text)}</span>` : `<span class="ars-node-text">${escape(n.text)}</span>`,
        delta =
          n === next
            ? markDelta(content, id, n.mark)
                .slice(0, 3)
                .map((c) => `<li><span>${escape(c.label)}</span><b>${number(c.before)}${escape(c.unit)} <i aria-hidden="true">→</i><span class="sr-only"> to </span> ${number(c.after)}${escape(c.unit)}</b></li>`)
                .join("")
            : "";
      return `<li class="ars-node is-${n.state}${sig ? " is-sig" : ""}" data-ars-node="${n.mark}"><span class="ars-node-pip" aria-hidden="true"></span><span class="ars-node-mk">${n.label}</span>${body}${nodeState(n)}${delta ? `<ul class="ars-delta" aria-label="${n.label} changes">${delta}</ul>` : ""}</li>`;
    })
    .join("");
  const sub = owned ? (forged ? `${ROMAN[forged - 1]} of V forged` : "none forged") : "after research";
  return `<section class="ars-sec ars-gear"><h3 class="ars-h">Gear <small>${sub}</small></h3><ol class="ars-track">${rows}</ol></section>`;
}

function vetHtml(a: Arsenal, id: TowerId, cost: number) {
  const xp = a.xp[id] ?? 0,
    v = veterancyOf(xp, cost),
    bar = v.span ? pct(v.into, v.span) : 100;
  return `<section class="ars-sec ars-vet"><h3 class="ars-h">Veterancy <span class="ars-rank">${rankChevrons(v.rank)}${v.rank ? `Rank ${v.rank}` : "Unranked"}</span></h3><div class="ars-xp"><span class="ars-xpbar" role="img" aria-label="${number(v.into)} of ${v.span ? number(v.span) : "max"} XP"><i style="width:${bar}%"></i></span><span class="ars-xp-n">${v.span ? `${number(v.into)} / ${number(v.span)} XP` : `${number(xp)} XP · top rank`}</span></div>${
    v.next ? `<p class="ars-next"><b>${number(v.next.xp)} XP to Rank ${v.next.rank}:</b> ${v.next.text}</p>` : ""
  }${v.passive ? `<p class="ars-passive">Build cost −${v.passive.pct}%: ◇ ${number(v.passive.before)} → ${number(v.passive.after)}</p>` : `<p class="ars-hint">Towers earn XP in campaign missions: kills, builds and assists.</p>`}</section>`;
}

function branchesHtml(id: TowerId, content: ContentPack) {
  const d = content.towers[id],
    { paths, tracks } = towerBranches(d),
    from = Math.min(...d.upgrades.filter((u) => u.path && u.effects.level !== undefined).map((u) => u.effects.level!)),
    list = (bs: TowerBranch[]) =>
      `<ul class="ars-paths">${bs
        .map(
          (b) =>
            `<li style="--path:${colorOf(b.color)}"><b>${escape(b.name)}</b>${b.role ? `<span>${escape(b.role)}</span>` : ""}<small>${b.tiers.map((t) => escape(t.label)).join(" › ")}</small></li>`,
        )
        .join("")}</ul>`;
  const out: string[] = [];
  if (tracks.length) out.push(`<h3 class="ars-h">Tracks <small>levels 2–4 · pick one</small></h3>${list(tracks)}`);
  if (paths.length) out.push(`<h3 class="ars-h">Specializations <small>levels ${from}–${from + 2} · pick one</small></h3>${list(paths)}`);
  return out.length ? `<section class="ars-sec ars-grows">${out.join("")}</section>` : "";
}

export interface DetailParts {
  head: string;
  body: string;
  foot: string;
  accent: string;
}
/** The selected tower's panel in three parts: head, scrolling body, and the action row (always on screen). */
export function detailParts(a: Arsenal, id: TowerId, content: ContentPack, underway: boolean): DetailParts {
  const t = content.towers[id],
    owned = owns(a, id),
    d = dossier(id, content),
    mark = a.gear[id] ?? 0,
    tag = owned ? (CORE_KIT.includes(id) ? "Core kit" : "Researched") : "Locked";
  const head = `<span class="ars-d-icon" aria-hidden="true">${towerIconHtml(t)}</span><div class="ars-d-title"><p class="ars-d-eyebrow">${d.page}${d.role.toLowerCase() === d.page.toLowerCase() ? "" : ` · ${escape(d.role)}`}</p><h2 id="ars-d-name">${escape(t.name)}</h2><p class="ars-d-standing"><span class="ars-d-tag${owned ? "" : " is-locked"}">${tag}</span>${owned ? `${rankChevrons(veterancy(a.xp[id]))}${markPips(mark)}` : ""}</p></div>`;
  const about = `<p class="ars-d-desc">${escape(d.description)}</p>${d.chips.length ? `<ul class="ars-chips">${d.chips.map((c) => `<li>${escape(c)}</li>`).join("")}</ul>` : ""}`,
    values = `<section class="ars-sec"><h3 class="ars-h">Base values <small>level 1</small></h3><dl class="ars-values">${d.values.map((v) => `<div><dt>${escape(v.label)}</dt><dd>${escape(v.value)}</dd></div>`).join("")}</dl></section>`;
  const body = owned ? `${about}${vetHtml(a, id, t.cost)}${trackHtml(a, id, content, true)}${values}${branchesHtml(id, content)}` : `${about}${values}${trackHtml(a, id, content, false)}${branchesHtml(id, content)}`;
  const note = underway ? `<p class="ars-underway">A mission is under way: purchases apply from the next mission start or Restart.</p>` : "";
  let action: string;
  if (!owned) {
    const r = researchBlock(a, id);
    action = r
      ? `<p class="ars-reason" id="ars-reason">${r.reason || `Unlocks ${escape(t.name)} for every campaign loadout.`}</p><button class="primary ars-buy" data-ars-buy="research" aria-describedby="ars-reason"${r.missing ? ' aria-disabled="true"' : ""}>Research <span class="ars-price">${number(r.price)}</span></button>`
      : "";
  } else {
    const f = forgeBlock(a, id, content);
    action = f
      ? `<p class="ars-reason" id="ars-reason">${f.reason || `${f.node.label}: ${escape(f.node.signature ?? f.node.text)}`}</p><button class="primary ars-buy" data-ars-buy="forge" aria-describedby="ars-reason"${f.reason ? ' aria-disabled="true"' : ""}>Forge ${f.node.label} <span class="ars-price">${number(f.node.price)}</span></button>`
      : `<p class="ars-reason is-done">All five marks forged${mark >= MAX_MARK ? ": the signature is active" : ""}.</p>`;
  }
  return { head, body, foot: `${note}<div class="ars-act">${action}</div>`, accent: hex(t.color) };
}
