import { cuesFor } from "./audio/cues";
import { AudioEngine } from "./audio/engine";
import { layersFor, type Drum } from "./audio/grooves";
import { extentFor, MUSIC, type Color } from "./audio/harmony";
import { colorOf, toneFor } from "./audio/intensity";
import type { DroneId } from "./audio/mood";
import { COMBAT_CUES, DRUM_CUES, FLOW_CUES, RECIPES, TIMING, UI_CUES, type CueId } from "./audio/recipes";
import { Score } from "./audio/score";
import { schedule, Sequencer, type Parts } from "./audio/sequencer";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { DEFAULT_CONTENT } from "./content";
import type { AttackSpec, GameEvent, TowerId } from "./core/types";
// Dev-only page (`/gallery.html?sound`): every cue, a music test with simulated tower fire and sliders for the two
// parts of the music, and a review sheet copied out as a markdown table.

const CRITERIA = [
  ["Clarity", "Can you tell what happened from the sound alone? 1 muddy, 5 instantly"],
  ["Fits the look", "Does it match the glowing sci-fi visuals? 1 out of place, 5 perfect"],
  ["Annoyance after 20×", "Click it about 20 times. 1 grating, 5 still pleasant"],
  ["Loudness vs. others", "1 badly too loud or quiet (say which in the notes), 5 balanced"],
  ["Feels in time", "During the music test: 1 off the beat, 5 locked to it"],
  ["Lag noticeable", "During the music test: 1 clearly late after the shot, 5 not noticeable"],
] as const;
const GROUPS = { Combat: COMBAT_CUES, Flow: FLOW_CUES, Interface: UI_CUES, Music: DRUM_CUES } as const;
const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const MIXES: Record<string, readonly AttackSpec["kind"][]> = {
  rapid: ["direct", "volley", "chain", "stun", "disrupt", "slow"],
  heavy: ["splash", "mortar", "quake", "focus", "pierce", "execute", "pull"],
  mixed: ["direct", "volley", "chain", "stun", "disrupt", "slow", "splash", "mortar", "quake", "focus", "pierce", "execute", "pull", "burn", "corrode", "decay", "net"],
};
const DRUM_CUE: Record<Drum, { id: CueId; gain: number }> = {
  kick: { id: "kick", gain: 1 },
  snare: { id: "snare", gain: 1 },
  hat: { id: "hat", gain: 1 },
  hat16: { id: "hat", gain: 0.6 },
  stomp: { id: "stomp", gain: 1 },
  bass: { id: "bass", gain: 1 },
};
const at = { x: 0, y: 0 };
const gridLabel = (id: CueId) => {
  const g = TIMING[id].grid;
  return `${g === 0 ? "instant" : g === 1 ? "bar" : g === 4 ? "beat" : `1/${g}`}${TIMING[id].pitched ? " · pitched" : ""}`;
};
const slider = (id: string, label: string, max: number, value: number) => `<label>${label} <input id="${id}" type="range" min="0" max="${max}" value="${value}"><output id="${id}-out">${value}</output></label>`;

export function mountSoundBoard(root: HTMLElement) {
  let engine: AudioEngine | null = null,
    timer: ReturnType<typeof setInterval> | null = null,
    color: Color = "drive",
    parts: Parts = { drums: [], arp: false, extent: 3, color };
  const score = new Score();
  const head = `<div class="sb-row sb-head"><span>Cue</span><span>Timing</span>${CRITERIA.map(([c, hint]) => `<span title="${hint}">${c}</span>`).join("")}<span>Notes</span></div>`;
  const rows = Object.entries(GROUPS)
    .map(([group, ids]) => `<h2>${group}</h2>${head}${ids.map(row).join("")}`)
    .join("");
  root.innerHTML = `<style>.sb{display:grid;gap:8px;max-width:1200px}.sb h2{margin:16px 0 4px}.sb-row{display:grid;grid-template-columns:8em 8em repeat(6,7.5em) 1fr;gap:6px;align-items:center}.sb-head span{font-size:11px;color:#8fa6b8}.sb-row small{color:#8fa6b8}.sb dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0}.sb dt{font-weight:600}.sb textarea{width:100%;height:12em}.sb fieldset{display:flex;flex-wrap:wrap;gap:12px;align-items:center}</style>
  <div class="sb"><p><button id="sb-start">Start audio</button> Rate each cue from 1 (bad) to 5 (good); leave a box empty if you have no opinion.</p>
  <dl>${CRITERIA.map(([c, hint]) => `<dt>${c}</dt><dd>${hint}</dd>`).join("")}</dl>
  <fieldset><legend>Music test</legend><label>Theme <select id="sb-theme">${Object.keys(MUSIC).map((d) => `<option${d === "outpost" ? " selected" : ""}>${d}</option>`).join("")}</select></label><output id="sb-info"></output>
  <label>Towers <select id="sb-mix">${Object.keys(MIXES).map((m) => `<option>${m}</option>`).join("")}</select></label>
  ${slider("sb-rate", "Shots/s", 80, 20)} ${slider("sb-threat", "Threat %", 100, 40)} ${slider("sb-defense", "Defense %", 100, 30)} ${slider("sb-clear", "Clear time s", 20, 6)}
  <label><input id="sb-heavy" type="checkbox"> Heavy enemy</label><button id="sb-boss">Boss appears</button>
  <label><input type="radio" name="sb-speed" value="1" checked> 1×</label><label><input type="radio" name="sb-speed" value="2"> 2×</label>
  <button id="sb-play">Play 16 bars</button><button id="sb-stop">Stop</button><output id="sb-out"></output></fieldset>
  ${rows}<p><button id="sb-copy">Copy results</button></p><textarea id="sb-copied" readonly></textarea></div>`;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const value = (id: string) => Number($<HTMLInputElement>(id).value);
  function ready() {
    if (!engine) {
      const e = (engine = new AudioEngine(new AudioContext()));
      e.volumes({ ...DEFAULT_SETTINGS, muted: false });
      new Sequencer(() => e.ctx.currentTime, (from, to) => {
        for (const b of schedule(score.clock, score.music, parts, from, to)) {
          if (b.kind === "chord") e.ambience.chord(b.notes, b.at);
          else if (b.kind === "arp") e.play(score.noteAt("arp", b.voice, 1, b.at));
          else e.play(score.noteAt(DRUM_CUE[b.drum].id, 0, DRUM_CUE[b.drum].gain, b.at));
        }
      }).start();
      theme();
    }
    return engine;
  }
  function theme() {
    const e = ready(),
      drone = $<HTMLSelectElement>("sb-theme").value as DroneId,
      now = e.ctx.currentTime;
    e.ambience.set({ drone, level: 0.6 });
    if (score.theme(drone, now)) e.ambience.chord(score.chordAt(now), now);
  }
  /** The two parts from the sliders, as the game derives them from threat, defense and clear time. */
  function measure(playing: boolean) {
    const defense = value("sb-defense") / 100;
    color = colorOf(value("sb-clear"), color);
    score.extent = extentFor(defense);
    parts = { drums: playing ? layersFor(value("sb-threat") / 100, $<HTMLInputElement>("sb-heavy").checked ? 1 : 0) : [], arp: defense >= 0.75, extent: score.extent, color };
    engine?.ambience.tone(toneFor(color, defense));
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    measure(false);
  }
  function play() {
    const e = ready();
    stop();
    const kinds = MIXES[$<HTMLSelectElement>("sb-mix").value],
      shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => !d.placement && kinds.includes(d.attack.kind)),
      speed = Number(document.querySelector<HTMLInputElement>("[name=sb-speed]:checked")!.value),
      end = e.ctx.currentTime + (16 * 4 * 60) / score.clock.bpm;
    let owed = 0,
      next = 0,
      played = 0,
      total = 0;
    timer = setInterval(() => {
      const now = e.ctx.currentTime,
        events: GameEvent[] = [];
      measure(true);
      for (owed += (value("sb-rate") * speed) / 30; owed >= 1; owed--, next++) {
        const d = shooters[next % shooters.length];
        events.push({ type: "shot", tower: d.id as TowerId, from: at, to: at, color: d.color });
        if (next % 5 === 0) events.push({ type: "kill", at, color: d.color, reward: 5 });
      }
      for (const c of cuesFor(events, DEFAULT_CONTENT, "game")) {
        total++;
        if (e.play(score.place(c, now))) played++;
      }
      $("sb-out").textContent = `${played} of ${total} cues played`;
      if (now >= end) stop();
    }, 1000 / 30);
  }
  $("sb-start").onclick = () => void ready().ctx.resume();
  $("sb-theme").onchange = theme;
  $("sb-play").onclick = play;
  $("sb-stop").onclick = stop;
  $("sb-boss").onclick = () => {
    const e = ready();
    e.play(score.place({ id: "boss", voice: 0, gain: 1 }, e.ctx.currentTime));
  };
  for (const id of ["sb-rate", "sb-threat", "sb-defense", "sb-clear"])
    $<HTMLInputElement>(id).oninput = () => {
      $(`${id}-out`).textContent = String(value(id));
      measure(timer !== null);
    };
  root.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) => {
    b.onclick = () => {
      const e = ready();
      e.play(score.place({ id: b.dataset.play as CueId, voice: 0, gain: 1 }, e.ctx.currentTime));
    };
  });
  setInterval(() => {
    if (!engine) return;
    const m = score.music,
      chord = score.chordAt(engine.ctx.currentTime).map((n) => NOTES[n % 12]).join(" ");
    $("sb-info").textContent = `${score.clock.bpm} BPM · ${NOTES[m.root % 12]} ${m.mode} · ${m.groove} · ${color} · chord ${chord}`;
  }, 200);
  $("sb-copy").onclick = () => {
    const lines = [`| Cue | ${CRITERIA.map(([c]) => c).join(" | ")} | Notes |`, `| --- |${CRITERIA.map(() => " --- |").join("")} --- |`];
    root.querySelectorAll<HTMLElement>(".sb-row[data-cue]").forEach((r) => {
      const scores = [...r.querySelectorAll<HTMLSelectElement>("select")].map((s) => s.value || "–");
      lines.push(`| ${r.dataset.cue} | ${scores.join(" | ")} | ${r.querySelector<HTMLInputElement>("input")!.value} |`);
    });
    const out = $<HTMLTextAreaElement>("sb-copied");
    out.value = lines.join("\n");
    navigator.clipboard?.writeText(out.value).catch(() => out.select());
  };
}
function row(id: CueId) {
  const r = RECIPES[id],
    select = ([c]: readonly [string, string]) => `<select aria-label="${c} of ${id}"><option></option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select>`;
  return `<div class="sb-row" data-cue="${id}"><button data-play="${id}">${id}</button><small title="cap ${r.cap} · gap ${r.gap}s">${gridLabel(id)}</small>${CRITERIA.map(select).join("")}<input placeholder="notes"></div>`;
}
