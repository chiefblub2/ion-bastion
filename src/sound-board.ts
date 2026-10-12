import { cuesFor } from "./audio/cues";
import { DRONES } from "./audio/drones";
import { AudioEngine } from "./audio/engine";
import type { DroneId } from "./audio/mood";
import { COMBAT_CUES, FLOW_CUES, RECIPES, UI_CUES, type CueId } from "./audio/recipes";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { DEFAULT_CONTENT } from "./content";
import type { GameEvent, TowerId } from "./core/types";
// Dev-only page (`/gallery.html?sound`): every cue, a burst test, the drones and a review sheet copied out as text.

const CRITERIA = ["Clarity", "Fits the look", "Annoyance after 20×", "Loudness vs. others"] as const;
const GROUPS = { Combat: COMBAT_CUES, Flow: FLOW_CUES, Interface: UI_CUES } as const;
const shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => !["aura", "income", "detect", "bounty", "repair", "mark"].includes(d.attack.kind));
const at = { x: 0, y: 0 };

export function mountSoundBoard(root: HTMLElement) {
  let engine: AudioEngine | null = null;
  const rows = Object.entries(GROUPS)
    .map(([group, ids]) => `<h2>${group}</h2>` + ids.map((id) => row(id)).join(""))
    .join("");
  root.innerHTML = `<style>.sb{display:grid;gap:8px;max-width:1100px}.sb h2{margin:16px 0 4px}.sb-row{display:grid;grid-template-columns:9em 5em repeat(4,auto) 1fr;gap:8px;align-items:center}.sb-row small{color:#8fa6b8}.sb textarea{width:100%;height:12em}</style>
  <div class="sb"><p><button id="sb-start">Start audio</button> Rate each cue 1 (bad) – 5 (good). Annoyance: play it 20× in a row.</p>
  <fieldset><legend>Burst test</legend><label>Shots/s <input id="sb-rate" type="range" min="5" max="80" value="30"><output id="sb-rate-out">30</output></label>
  <label><input type="radio" name="sb-speed" value="1" checked> 1×</label><label><input type="radio" name="sb-speed" value="2"> 2×</label>
  <button id="sb-burst">Run 10 s</button> <output id="sb-burst-out"></output></fieldset>
  <fieldset><legend>Ambience</legend><select id="sb-drone">${Object.keys(DRONES).map((d) => `<option>${d}</option>`).join("")}</select>
  <label>Level <input id="sb-level" type="range" min="0" max="100" value="60"></label><button id="sb-stop">Stop</button></fieldset>
  ${rows}<p><button id="sb-copy">Copy results</button></p><textarea id="sb-out" readonly></textarea></div>`;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  function ready() {
    if (!engine) {
      engine = new AudioEngine(new AudioContext());
      engine.volumes({ ...DEFAULT_SETTINGS, muted: false });
    }
    return engine;
  }
  $("sb-start").onclick = () => void ready().ctx.resume();
  root.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) => (b.onclick = () => ready().play({ id: b.dataset.play as CueId, pitch: 1, gain: 1 })));
  $<HTMLInputElement>("sb-rate").oninput = (e) => ($("sb-rate-out").textContent = (e.target as HTMLInputElement).value);
  $("sb-burst").onclick = () => burst(ready());
  const drone = () => ready().ambience.set({ drone: $<HTMLSelectElement>("sb-drone").value as DroneId, level: Number($<HTMLInputElement>("sb-level").value) / 100 });
  $("sb-drone").onchange = drone;
  $("sb-level").oninput = drone;
  $("sb-stop").onclick = () => ready().ambience.stop();
  $("sb-copy").onclick = () => {
    const lines = [`| Cue | ${CRITERIA.join(" | ")} | Notes |`, `| --- |${CRITERIA.map(() => " --- |").join("")} --- |`];
    root.querySelectorAll<HTMLElement>(".sb-row").forEach((r) => {
      const scores = [...r.querySelectorAll<HTMLSelectElement>("select")].map((s) => s.value || "–");
      lines.push(`| ${r.dataset.cue} | ${scores.join(" | ")} | ${r.querySelector<HTMLInputElement>("input")!.value} |`);
    });
    const out = $<HTMLTextAreaElement>("sb-out");
    out.value = lines.join("\n");
    navigator.clipboard?.writeText(out.value).catch(() => out.select());
  };
}
function row(id: CueId) {
  const r = RECIPES[id],
    select = (c: string) => `<select aria-label="${c} of ${id}"><option></option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select>`;
  return `<div class="sb-row" data-cue="${id}"><button data-play="${id}">${id}</button><small>cap ${r.cap} · gap ${r.gap}s</small>${CRITERIA.map(select).join("")}<input placeholder="notes"></div>`;
}
/** Shots from every attack tower in turn, plus a kill per five shots, fed through the real cue mapping and mixer. */
function burst(engine: AudioEngine) {
  const rate = Number((document.getElementById("sb-rate") as HTMLInputElement).value),
    speed = Number(document.querySelector<HTMLInputElement>("[name=sb-speed]:checked")!.value),
    out = document.getElementById("sb-burst-out")!;
  let frames = 0, owed = 0, next = 0, played = 0, total = 0;
  const timer = setInterval(() => {
    const events: GameEvent[] = [];
    for (owed += (rate * speed) / 30; owed >= 1; owed--, next++) {
      const d = shooters[next % shooters.length];
      events.push({ type: "shot", tower: d.id as TowerId, from: at, to: at, color: d.color });
      if (next % 5 === 0) events.push({ type: "kill", at, color: d.color, reward: 5 });
    }
    for (const c of cuesFor(events, DEFAULT_CONTENT, "game")) {
      total++;
      if (engine.play(c)) played++;
    }
    out.textContent = `${played} of ${total} cues played`;
    if (++frames >= 300) clearInterval(timer);
  }, 1000 / 30);
}
