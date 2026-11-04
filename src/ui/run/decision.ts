// Rewards, one decision at a time (`decisionHtml`): the draft, relics, Doctrines, the act reward, a roster replacement.
import type { TowerId } from "../../core/types";
import { isSpecialization } from "../../core/upgrades";
import { bossModOf } from "../../run/boss";
import { MASTERY } from "../../run/ranks";
import { relicFit } from "../../run/relic-fit";
import { relicOf, type RelicId } from "../../run/relics";
import { rewardProgress, rewardSteps } from "../../run/rewards";
import { doctrineCandidates, doctrinePaths, pendingPicks, rankOfTower, rerollPrice, rosterCap, towerRarity, type RunState } from "../../run/run";
import { sharedTags, tagsOf, TAG_LABEL } from "../../run/tags";
import { rosterCovers, type Need } from "../../run/threats";
import { RETIRE, SKIP_RELIC, SKIP_TOWER } from "../../run/tuning";
import { escape } from "../format";
import { towerIconHtml } from "../tower-codex";
import { pageOf, TOWER_PAGES } from "../tower-pages";
import { page, STARS } from "./state";
import { towerChip, towerName } from "./pieces";
// ── Rewards: one decision at a time ──
/** A selectable option of a decision; `key` is what `pick:` and `take` carry. */
export interface Option {
  key: string;
  html: string;
  rarity?: string;
  label: string;
  /** Shown but not selectable (sold, too dear for an event choice, a tower that holds the mod). */
  disabled?: boolean;
}
/**
 * One decision: its options as compact cards (a tap selects), the selected option's details beside them, and the
 * actions in a fixed row: confirm, skip, reroll. `head` carries the mission's result above the first one.
 */
export function decisionHtml(d: { step: string; eyebrow: string; title: string; note?: string; options: Option[]; preview: string; actions: string; head?: string; extra?: string }) {
  const options = d.options
    .map(
      (o) =>
        `<button class="choice-card run-card run-option"${o.rarity ? ` data-rarity="${o.rarity}"` : ""} data-run="pick:${o.key}" aria-pressed="${page.selected === o.key}" aria-label="${escape(o.label)}"${o.disabled ? " disabled" : ""}>${o.html}</button>`,
    )
    .join("");
  return `<section class="run-decision" data-step="${d.step}" aria-label="${escape(d.title)}">${d.head ?? ""}<header class="run-decision-head"><p class="choice-index">${d.eyebrow}</p><h2 class="run-step-title">${d.title}</h2></header>${d.extra ?? ""}<div class="run-choices" data-count="${d.options.length}">${options}</div><div class="run-preview" aria-live="polite">${
    d.note ? `<p class="run-decision-note">${d.note}</p>` : ""
  }${d.preview}</div><div class="run-decision-actions">${d.actions}</div></section>`;
}
export const takeButton = (label: string | undefined, enabled = !!label) =>
  `<button class="primary run-take" data-run="take"${enabled ? "" : " disabled"}>${label ? escape(label) : "Select an option"} <span>→</span></button>`;
export const emptyPreview = (text: string) => `<p class="run-preview-empty">${text}</p>`;
/** The eyebrow of a reward decision: "REWARD 2 OF 3", or the step's own name when it is the only one. */
export function eyebrow(r: RunState, own: string) {
  const { index, total } = rewardProgress(r);
  return total > 1 ? `REWARD ${index} OF ${total} · ${own}` : own;
}
const NEED_TEXT: Record<Need, string> = { air: "hits flyers", detect: "reveals stealth", under: "hits burrowed units" };
/** What a tower adds to the roster's answers (flyers, stealth, burrowed units). */
function addsText(r: RunState, id: TowerId) {
  const before = rosterCovers(r.roster, page.host.content),
    mine = rosterCovers([id], page.host.content),
    fresh = (Object.keys(mine) as Need[]).filter((n) => mine[n] && !before[n]);
  return fresh.length ? `<p class="run-gain">New for your roster: ${fresh.map((n) => NEED_TEXT[n]).join(", ")}.</p>` : "";
}
function towerOption(r: RunState, id: TowerId): Option {
  const d = page.host.content.towers[id],
    rarity = towerRarity(id, page.host.content),
    shared = sharedTags(id, r.roster, page.host.content);
  return {
    key: id,
    rarity,
    label: d.name,
    html: `<span class="run-icon">${towerIconHtml(d)}</span><span class="run-option-text"><strong>${escape(d.name)}</strong><small>${rarity} · ${TOWER_PAGES[pageOf(d)].name} · ◇ ${d.cost}</small>${
      shared.length ? `<em class="run-fit">Synergy</em>` : ""
    }</span>`,
  };
}
export function towerPreview(r: RunState, id: TowerId) {
  const d = page.host.content.towers[id],
    shared = sharedTags(id, r.roster, page.host.content),
    tags = tagsOf(d).map((t) => `<li${shared.includes(t) ? " data-shared" : ""}>${TAG_LABEL[t]}</li>`).join("");
  return `<h3>${escape(d.name)}</h3><p><b>${escape(d.role)}.</b> ${escape(d.description)}</p><ul class="run-tags">${tags}</ul>${
    shared.length ? `<p class="run-synergy">Synergy with your roster: ${shared.map((t) => TAG_LABEL[t]).join(", ")}</p>` : ""
  }${addsText(r, id)}`;
}
function draftDecision(r: RunState, head = "") {
  const offers = r.offers.towers!,
    full = r.roster.length >= rosterCap(r),
    pick = page.selected && offers.includes(page.selected as TowerId) ? (page.selected as TowerId) : undefined;
  return decisionHtml({
    step: "towers",
    head,
    eyebrow: eyebrow(r, "TOWER DRAFT"),
    title: "Draft a tower",
    note: full ? `Your roster is full (${r.roster.length}/${rosterCap(r)}): a new tower replaces one, and you see what it costs first.` : undefined,
    options: offers.map((id) => towerOption(r, id)),
    preview: pick ? towerPreview(r, pick) : emptyPreview("Select a tower to see what it does and how it fits your roster."),
    actions: `<button class="quiet" data-run="skip">Skip (+◈ ${SKIP_TOWER})</button><button class="quiet" data-run="reroll"${r.scrap < rerollPrice(r) ? " disabled" : ""}>Reroll (◈ ${rerollPrice(r)})</button>${takeButton(
      pick && (full ? `Replace a tower with ${towerName(pick)}` : `Draft ${towerName(pick)}`),
    )}`,
  });
}
function relicOption(r: RunState, id: RelicId, slot: RelicSlot): Option {
  const relic = relicOf(id),
    fit = relicFit(r, id, page.host.content);
  return {
    key: id,
    rarity: relic.rarity,
    label: relic.name,
    html: `<span class="run-icon run-glyph" aria-hidden="true">${relic.icon}</span><span class="run-option-text"><strong>${escape(relic.name)}</strong><small>${relic.rarity === "signature" ? "boss tech" : relic.rarity}${slot === "prize" && relic.rarity === "cursed" ? " · +◈ 30" : ""}</small>${
      relic.wantsText || relic.category === "build" ? `<em class="run-fit" data-fits="${fit.fits}">${fit.fits ? "Fits your build" : "No fit yet"}</em>` : ""
    }</span>`,
  };
}
export function relicPreview(r: RunState, id: RelicId, slot: RelicSlot) {
  const relic = relicOf(id),
    fit = relicFit(r, id, page.host.content),
    upside = relic.downside ? relic.description.replace(relic.downside, "").replace(/[;,]\s*(but\s*)?$/i, "").trim().replace(/[^.]$/, "$&.") : relic.description;
  return `<h3><i aria-hidden="true">${relic.icon}</i> ${escape(relic.name)}</h3>${
    relic.boss ? `<p class="run-origin">Boss technology recovered from the ${escape(bossModOf(relic.boss).name)}. Lasts for this run.</p>` : ""
  }<p class="run-upside">${escape(upside)}</p>${
    relic.downside ? `<p class="run-downside">Price: ${escape(relic.downside)}</p>` : ""
  }${slot === "prize" && relic.rarity === "cursed" ? `<p class="run-gain">Taking it pays 30 Scrap.</p>` : ""}<p class="run-fit-note" data-fits="${fit.fits}">${escape(fit.note)}</p>`;
}
type RelicSlot = "relics" | "prize" | "legendary";
const RELIC_STEP: Record<RelicSlot, { title: string; own: string; skip: () => string }> = {
  relics: { title: "Take a relic", own: "RELIC", skip: () => `Skip (+◈ ${SKIP_RELIC})` },
  prize: { title: "Elite prize", own: "ELITE PRIZE", skip: () => "Skip the prize" },
  legendary: { title: "A legendary relic", own: "LEGENDARY RELIC", skip: () => "Skip" },
};
function relicDecision(r: RunState, slot: RelicSlot, head = "") {
  const offers = r.offers[slot]!,
    pick = page.selected && offers.includes(page.selected as RelicId) ? (page.selected as RelicId) : undefined,
    s = RELIC_STEP[slot];
  return decisionHtml({
    step: slot,
    head,
    eyebrow: eyebrow(r, s.own),
    title: s.title,
    note: slot === "prize" ? "Rare and legendary relics, and a cursed one that pays Scrap." : undefined,
    options: offers.map((id) => relicOption(r, id, slot)),
    preview: pick ? relicPreview(r, pick, slot) : emptyPreview("Select a relic to see what it does and whether it fits your build."),
    actions: `<button class="quiet" data-run="skip">${s.skip()}</button>${takeButton(pick && `Take ${relicOf(pick).name}`)}`,
  });
}
/** The roster towers that can take a Doctrine as tabs, and the paths of the selected one as options. */
export function doctrineDecision(r: RunState, head = "", mode: "reward" | "act" | "shop" = "reward") {
  const act = mode === "act";
  const candidates = doctrineCandidates(r, page.host.content),
    tower = page.doctrineTower && candidates.includes(page.doctrineTower) ? page.doctrineTower : candidates[0];
  if (!tower)
    return decisionHtml({ step: "doctrine", head, eyebrow: eyebrow(r, "DOCTRINE"), title: "Choose a Doctrine", options: [], preview: emptyPreview("No tower in your roster can take a Doctrine."), actions: `<button class="quiet" data-run="skip">Skip</button>` });
  const d = page.host.content.towers[tower],
    paths = doctrinePaths(r, tower, page.host.content),
    pick = page.selected && page.selected.startsWith(`${tower}:`) && paths.includes(page.selected.split(":")[1]) ? page.selected.split(":")[1] : undefined,
    tabs = candidates.map((id) => `<button class="quiet run-mini" data-run="doctrine-tower:${id}"${id === tower ? ' aria-pressed="true"' : ""}>${escape(towerName(id))}</button>`).join(""),
    options = paths.map((path): Option => {
      const v = d.visual.paths?.[path],
        color = v ? `#${v.color.toString(16).padStart(6, "0")}` : "var(--run)";
      return { key: `${tower}:${path}`, label: v?.name ?? path, html: `<span class="run-path-dot" style="--path:${color}" aria-hidden="true"></span><span class="run-option-text"><strong>${escape(v?.name ?? path)}</strong><small>${escape(v?.role ?? "")}</small></span>` };
    });
  let preview = emptyPreview("A Doctrine unlocks one specialization path of a tower type for the rest of the run (levels 6–8; 4–6 for support towers, 5–7 for Aura). Select a path to see its tiers.");
  if (pick) {
    const v = d.visual.paths?.[pick],
      tiers = d.upgrades.filter((u) => isSpecialization(u) && u.path === pick);
    preview = `<h3>${escape(towerName(tower))}: ${escape(v?.name ?? pick)}</h3><p>${escape(v?.role ?? "")}</p><ol class="run-tiers">${tiers.map((u) => `<li>${escape(u.description)}</li>`).join("")}</ol><p class="run-note">${escape(towerName(tower))} is committed to this path for the rest of the run.</p>`;
  }
  return decisionHtml({
    step: "doctrine",
    head,
    eyebrow: mode === "shop" ? `FORGE · ◈ ${r.offers.shop?.[page.targeting ?? -1]?.price ?? ""}` : eyebrow(r, "DOCTRINE"),
    title: act ? "Your act reward: a Doctrine" : mode === "shop" ? "Buy a Doctrine" : "Choose a Doctrine",
    extra: `<div class="run-row run-doctrine-tabs" aria-label="Tower">${tabs}</div>`,
    options,
    preview,
    actions: `${act ? `<button class="quiet" data-run="act-back">Back</button>` : mode === "shop" ? `<button class="quiet" data-run="cancel">Cancel</button>` : `<button class="quiet" data-run="skip">Skip</button>`}${takeButton(pick && `${mode === "shop" ? "Buy" : "Commit to"} ${d.visual.paths?.[pick]?.name ?? pick}`)}`,
  });
}
/** The act transition: a legendary relic or a Doctrine (one of the two, unless Master License grants both). */
function actDecision(r: RunState, head = "") {
  if (page.actDoctrine) return doctrineDecision(r, head, "act");
  const offers = r.offers.legendary!,
    options: Option[] = [
      ...offers.map((id) => relicOption(r, id, "legendary")),
      { key: "doctrine", label: "Doctrine", html: `<span class="run-icon run-glyph" aria-hidden="true">✦</span><span class="run-option-text"><strong>A Doctrine</strong><small>a specialization path</small></span>` },
    ],
    pick = page.selected && (page.selected === "doctrine" || offers.includes(page.selected as RelicId)) ? page.selected : undefined;
  return decisionHtml({
    step: "act",
    head,
    eyebrow: eyebrow(r, "ACT REWARD"),
    title: "Choose your act reward",
    note: offers.some((id) => relicOf(id).boss)
      ? "The boss's technology, a legendary relic or a Doctrine: taking one gives up the others."
      : "A legendary relic or a Doctrine: taking one gives up the other.",
    options,
    preview: !pick
      ? emptyPreview("Select a relic or the Doctrine to see the details.")
      : pick === "doctrine"
        ? `<h3>✦ A Doctrine</h3><p>Unlock one specialization path of a roster tower for the rest of the run. You choose the tower and path next.</p><p class="run-fit-note" data-fits="true">${escape(doctrineCandidates(r, page.host.content).map(towerName).join(", "))} can take one.</p>`
        : relicPreview(r, pick as RelicId, "legendary"),
    actions: `<button class="quiet" data-run="skip">Skip both</button>${takeButton(pick && (pick === "doctrine" ? "Choose the Doctrine" : `Take ${relicOf(pick as RelicId).name}`))}`,
  });
}
/** Replacing a roster tower: what the replaced one takes with it, before anything changes. */
function replaceDecision(r: RunState) {
  const t = page.replacing!.tower,
    pick = page.selected && r.roster.includes(page.selected as TowerId) ? (page.selected as TowerId) : undefined,
    options = r.roster.map((id): Option => {
      const d = page.host.content.towers[id],
        rank = rankOfTower(r, id);
      return { key: id, label: d.name, html: `<span class="run-icon">${towerIconHtml(d)}</span><span class="run-option-text"><strong>${escape(d.name)}</strong><small>rank ${rank}${r.doctrines.some((x) => x.startsWith(`${id}:`)) ? " · Doctrine" : ""}${r.mods.some((m) => m.tower === id) ? " · mods" : ""}</small></span>` };
    });
  return decisionHtml({
    step: "replace",
    eyebrow: "ROSTER FULL",
    title: `Replace a tower with ${escape(towerName(t))}`,
    options,
    preview: pick ? replacePreview(r, pick, t) : emptyPreview(`Select the roster tower ${escape(towerName(t))} replaces to see what you lose.`),
    actions: `<button class="quiet" data-run="cancel">Cancel</button>${takeButton(pick && `Replace ${towerName(pick)}`)}`,
  });
}
function replacePreview(r: RunState, out: TowerId, incoming: TowerId) {
  const xp = r.ranks[out] ?? 0,
    rank = rankOfTower(r, out),
    d = page.host.content.towers[out],
    doctrines = r.doctrines.filter((x) => x.startsWith(`${out}:`)).map((x) => d.visual.paths?.[x.split(":")[1]]?.name ?? x.split(":")[1]),
    mods = r.mods.filter((m) => m.tower === out).map((m) => (m.kind === "drill" ? "Drill (level 2 for 1 credit)" : "Prototype discount (25% off)")),
    before = rosterCovers(r.roster, page.host.content),
    after = rosterCovers([...r.roster.filter((id) => id !== out), incoming], page.host.content),
    lost = (Object.keys(before) as Need[]).filter((n) => before[n] && !after[n]),
    gained = (Object.keys(before) as Need[]).filter((n) => !before[n] && after[n]),
    rows = [
      `<li data-loss="${xp > 0}">Rank ${rank}, ${xp} XP${xp ? " — lost" : ""}</li>`,
      doctrines.length ? `<li data-loss="true">Doctrine: ${escape(doctrines.join(", "))} — lost</li>` : `<li>No Doctrine</li>`,
      mods.length ? `<li data-loss="true">Shop mods: ${escape(mods.join(", "))} — lost</li>` : `<li>No shop mods</li>`,
      lost.length ? `<li data-loss="true">Your roster no longer ${lost.map((n) => NEED_TEXT[n]).join(", ")}.</li>` : "",
      gained.length ? `<li data-gain="">${escape(towerName(incoming))} adds: ${gained.map((n) => NEED_TEXT[n]).join(", ")}.</li>` : "",
    ].join("");
  return `<h3>${escape(d.name)} → ${escape(towerName(incoming))}</h3><ul class="run-loss">${rows}</ul><p class="run-note">Nothing changes until you confirm.</p>`;
}
/** The mission's result, above the first reward decision. */
function clearedHtml(r: RunState) {
  const last = r.log[r.log.length - 1],
    ups = r.offers.rankUps
      ?.map((id) => {
        const rank = rankOfTower(r, id),
          m = rank >= 4 ? MASTERY[id] : undefined;
        return `${escape(towerName(id))} rank ${rank}${m ? `, Mastery: ${escape(m.name)}` : ""}`;
      })
      .join(" · ");
  return `<p class="run-cleared"><b>Mission cleared</b> ${last?.stars ? `${STARS(last.stars)} · ` : ""}+◈ ${last?.scrap ?? 0} · reactor ${last?.end ?? r.reactor} → ${r.reactor}${ups ? ` · <span class="run-rankup">▲ ${ups}</span>` : ""}</p>`;
}
/** The current decision of a reward, camp or act screen, or undefined when every pick is made; `head` tops the first one. */
export function pendingDecision(r: RunState, head = "") {
  if (page.replacing) return replaceDecision(r);
  if (rewardProgress(r).index > 1) head = "";
  const step = rewardSteps(r)[0];
  if (!step) return undefined;
  return step === "towers" ? draftDecision(r, head) : step === "doctrine" ? doctrineDecision(r, head) : step === "act" ? actDecision(r, head) : relicDecision(r, step, head);
}
function rosterManageHtml(r: RunState) {
  if (r.roster.length <= 1) return "";
  return `<details class="run-manage"><summary>Retire a tower (+◈ ${RETIRE})</summary><ul class="run-chips run-pick">${r.roster
    .map((id) => towerChip(r, id, `<button class="quiet run-mini" data-run="retire:${id}">${page.armed === `retire:${id}` ? "Confirm" : "Retire"}</button>`))
    .join("")}</ul></details>`;
}
export function continueHtml(r: RunState, label: string) {
  const open = pendingPicks(r);
  return `<div class="run-row run-continue"><button class="primary" data-run="continue"${open ? " disabled" : ""}>${label} <span>→</span></button>${open ? `<p class="run-note">Pick or skip every offer first.</p>` : ""}</div>`;
}
export function rewardHtml(r: RunState) {
  const head = clearedHtml(r);
  return (
    pendingDecision(r, head) ??
    `<section class="run-decision run-done">${head}<header class="run-decision-head"><p class="choice-index">REWARDS CLAIMED</p><h2 class="run-step-title">${r.node?.kind === "boss" ? "Act boss defeated" : "Ready to move on"}</h2></header>${rosterManageHtml(r)}${continueHtml(r, r.node?.kind === "boss" ? "Cross to the next act" : "Back to the map")}</section>`
  );
}
