// The mission debrief (`/#debrief`): outcome and stars, the Salvage ledger, tower XP, what the win opened, the loss tip
// and the way on. Rendered from the `Debrief` alone (`app/campaign-session.ts`), so a reload shows it again. Every
// section is laid out from the start and staged by opacity, so the page never jumps; numbers count up; a tap or key
// press (or reduced motion) shows the final state at once.
import "./debrief.css";
import { rankProgress } from "../campaign/arsenal";
import type { Debrief } from "../campaign/debrief";
import { starText } from "../campaign/rating";
import { roman } from "./atlas/model";
import { debriefKey, ledgerLabel, leakText, outcomeTitle, rankRowLabel, rankUpText, ratingText, wavesText } from "./debrief-text";
import type { ContentPack } from "../core/types";
import { escape, number } from "./format";
import { rankChevrons } from "./gear-badge";
import { hex } from "./atlas/model";
import { towerIconHtml } from "./tower-codex";

const STAGED_KEY = "ion-bastion:debrief-staged";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pct = (n: number, of: number) => Math.max(0, Math.min(100, (100 * n) / of));

/** The XP bar of one tower: where it starts and ends within its rank's span (a rank-up restarts the bar). */
export function xpBar(g: { xpBefore: number; xpAfter: number }) {
  const before = rankProgress(g.xpBefore),
    after = rankProgress(g.xpAfter);
  return {
    from: before.rank === after.rank && before.span ? pct(before.into, before.span) : 0,
    to: after.span ? pct(after.into, after.span) : 100,
    into: after.into,
    span: after.span,
  };
}

const count = (n: number, plus = false) => `<b data-count="${n}"${plus ? ' data-plus=""' : ""}>${plus ? "+" : ""}${number(n)}</b>`;

function ledgerHtml(d: Debrief) {
  const row = (label: string, value: string, cls = "") => `<li class="db-row${cls}"><span>${label}</span>${value}</li>`,
    rows = d.pay.lines.map((l) => row(ledgerLabel(l, d.won), count(l.amount, true), ` db-pay-${l.kind}`));
  if (d.pay.ranks > 0) rows.push(row(rankRowLabel(d.ranks), count(d.pay.ranks, true), " db-rankbonus"));
  if (!rows.length) rows.push(`<li class="db-row is-empty"><span>No Salvage earned</span><b>+0</b></li>`);
  return `<h2 class="db-h">Salvage</h2><ul class="db-rows">${rows.join("")}</ul><p class="db-total"><span>Total</span>${count(d.pay.total, true)}</p><p class="db-balance"><span>Balance</span><b><span class="db-from">${number(d.salvage.before)}</span> <i aria-hidden="true">→</i> <span data-count="${d.salvage.after}" data-from="${d.salvage.before}">${number(d.salvage.after)}</span></b></p>`;
}

function tilesHtml(d: Debrief, content: ContentPack) {
  if (!d.ranks.length) return `<p class="db-none">No tower earned XP.</p>`;
  return `<ul class="db-tiles">${d.ranks
    .map((g) => {
      const t = content.towers[g.id],
        bar = xpBar(g),
        up = rankUpText(g),
        gain = g.xpAfter - g.xpBefore,
        long = up ? up.long : `+${number(gain)} XP${bar.span ? ` · ${number(bar.into)} / ${number(bar.span)}` : " · max rank"}`,
        short = up ? up.short : `+${number(gain)}`;
      return `<li class="db-tile${up ? " is-up" : ""}" style="--accent:${t ? hex(t.color) : "var(--ion-accent)"}"><span class="db-tile-icon" aria-hidden="true">${t ? towerIconHtml(t) : ""}</span><span class="db-tile-name">${escape(g.name)}</span><span class="db-tile-rank">${rankChevrons(g.rankAfter)}</span><span class="db-bar" style="--from:${bar.from}%;--to:${bar.to}%"><i></i></span><span class="db-tile-xp"><span class="db-long">${escape(long)}</span><span class="db-short" aria-hidden="true">${escape(short)}</span></span></li>`;
    })
    .join("")}</ul>`;
}

function stripHtml(d: Debrief) {
  const block = (cls: string, key: string, body: string) => `<p class="db-block ${cls}"><b class="db-k">${key}</b><span>${body}</span></p>`,
    out: string[] = [];
  if (d.secured) {
    const s = d.secured;
    out.push(block("db-secured", "Sector secured", `<strong>${escape(s.name)}</strong> · ★ ${s.stars}/${s.max} · Cache +${number(s.cache)}${s.slot ? " · <em>+1 loadout slot</em>" : ""}`));
  }
  const opened = [...d.unlocked.sectors.map((s) => `Sector ${roman(s.number - 1)} · ${escape(s.name)}`), ...d.unlocked.missions.map((m) => escape(m.name))];
  if (opened.length) out.push(block("db-unlocked", "Unlocked", opened.join(" · ")));
  if (!d.won && d.leaks.length) out.push(block("db-leaks", "Leaked most", escape(leakText(d.leaks))));
  if (!d.won && d.tip) out.push(block("db-tip", "Tip", escape(d.tip.text)));
  if (d.ready > 0) out.push(`<p class="db-block db-ready"><span><b>${d.ready}</b> ${d.ready === 1 ? "upgrade" : "upgrades"} ready in the Arsenal</span></p>`);
  return out.join("");
}

/** The Next button's label and what the Next button leads to, for the page and the tests of the flow. */
function nextLabel(d: Debrief, content: ContentPack) {
  switch (d.next.kind) {
    case "briefing":
      return `Next: ${escape(content.missions.find((m) => m.id === d.next.id)?.name ?? "mission")}`;
    case "atlas":
      return "Sector map";
    case "victory":
      return "Campaign complete";
    default:
      return "";
  }
}

function actionsHtml(d: Debrief, content: ContentPack) {
  const next = d.next.kind === "none" ? "" : `<button class="primary db-primary" data-debrief="next"><span class="db-label">${nextLabel(d, content)}</span> <span aria-hidden="true">→</span></button>`,
    replay = `<button class="${d.won ? "quiet" : "primary db-primary"}" data-debrief="replay">Replay <span aria-hidden="true">↺</span></button>`;
  return `<div class="db-actions">${next}${replay}<button class="quiet" data-arsenal>⚒ Arsenal</button><button class="quiet" data-debrief="missions">Missions</button><button class="quiet" data-debrief="field">Battlefield</button></div>`;
}

/** Fills the page (once per call) and stages it unless that debrief was staged before in this tab or motion is reduced. */
export function renderDebrief(root: HTMLElement, d: Debrief, content: ContentPack) {
  stopStaging();
  const eyebrow = document.getElementById("debrief-title-eyebrow"),
    title = document.getElementById("debrief-title");
  if (eyebrow) eyebrow.textContent = `DEBRIEF · MISSION ${String(d.mission.number).padStart(2, "0")} · SECTOR ${roman(d.sector.number - 1)}`;
  if (title) title.textContent = d.mission.name;
  const best = d.won && d.stars > d.best;
  root.innerHTML = `<div class="db ${d.won ? "is-won" : "is-lost"}">
<header class="db-sec db-outcome" aria-label="Result"><h2 class="db-title">${outcomeTitle(d)}</h2><p class="db-sub">${wavesText(d)}</p><p class="db-starline"><span class="db-stars" role="img" aria-label="${d.stars} of 3 stars">${starText(d.stars)}</span>${best ? '<b class="db-best">New best</b>' : ""}</p>${d.won ? `<p class="db-rule">${escape(ratingText(d))}</p>` : ""}</header>
<section class="db-sec db-ledger" aria-label="Salvage">${ledgerHtml(d)}</section>
<section class="db-sec db-xp" aria-label="Tower XP"><h2 class="db-h">Tower XP</h2>${tilesHtml(d, content)}</section>
<div class="db-sec db-strip">${stripHtml(d)}</div>
${actionsHtml(d, content)}
</div>`;
  const key = debriefKey(d);
  let seen: string | null = null;
  try {
    seen = sessionStorage.getItem(STAGED_KEY);
    sessionStorage.setItem(STAGED_KEY, key);
  } catch {
    // Staged again after a reload.
  }
  if (seen !== key && !reduced()) stage(root.firstElementChild as HTMLElement);
}
/** Puts the focus on the primary action (Next on a win, Replay on a loss). */
export const focusPrimary = (root: HTMLElement) => root.querySelector<HTMLElement>(".db-primary")?.focus({ preventScroll: true });

let stop: (() => void) | undefined;
/** Ends a staging in progress with the final state (the page is leaving or filling again). */
export function stopStaging() {
  stop?.();
}
/**
 * The staging, about two seconds: the result, the ledger (its numbers count up), the tower XP (its bars fill) and the
 * strip fade in one after another. A tap or key press ends it at once.
 */
function stage(db: HTMLElement) {
  const secs = [".db-outcome", ".db-ledger", ".db-xp", ".db-strip"].map((s) => db.querySelector<HTMLElement>(s)!),
    at = [0, 250, 800, 1500],
    counts = [...db.querySelectorAll<HTMLElement>("[data-count]")].map((el, i, all) => ({
      el,
      from: Number(el.dataset.from ?? 0),
      to: Number(el.dataset.count),
      plus: el.dataset.plus !== undefined,
      // The ledger rows count one after another; the total and the balance after the last row.
      start: 300 + i * Math.min(110, 700 / Math.max(1, all.length)),
    })),
    show = (el: HTMLElement, v: number, plus: boolean) => (el.textContent = `${plus && v > 0 ? "+" : ""}${number(v)}`),
    timers: number[] = [],
    t0 = performance.now();
  let raf = 0;
  const DURATION = 600;
  db.classList.add("is-staging");
  for (const c of counts) show(c.el, c.from, c.plus);
  secs.forEach((s, i) => timers.push(window.setTimeout(() => s.classList.add("is-in"), at[i])));
  const tick = () => {
    const now = performance.now() - t0;
    let busy = false;
    for (const c of counts) {
      const p = Math.max(0, Math.min(1, (now - c.start) / DURATION));
      show(c.el, Math.round(c.from + (c.to - c.from) * (1 - (1 - p) ** 3)), c.plus);
      if (p < 1) busy = true;
    }
    if (busy) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const end = () => {
    timers.forEach(clearTimeout);
    cancelAnimationFrame(raf);
    removeEventListener("pointerdown", end, true);
    removeEventListener("keydown", end, true);
    for (const c of counts) show(c.el, c.to, c.plus);
    db.classList.add("is-skip");
    db.classList.remove("is-staging");
    if (stop === end) stop = undefined;
  };
  stop = end;
  addEventListener("pointerdown", end, true);
  addEventListener("keydown", end, true);
  // Natural end: after the last beat.
  timers.push(window.setTimeout(end, 2200));
}
