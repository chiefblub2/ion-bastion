import { Conductor, type Phase } from "./audio/conductor";
import { cuesFor } from "./audio/cues";
import { AudioEngine } from "./audio/engine";
import { FAMILIES, familyOf, type Family } from "./audio/families";
import { MUSIC } from "./audio/harmony";
import { INSTRUMENTS, REGISTER, type Instrument } from "./audio/instruments";
import type { DroneId } from "./audio/mood";
import { COMBAT_CUES, FLOW_CUES, RECIPES, SHOT_CUES, TIMING, UI_CUES, type CueId } from "./audio/recipes";
import { Sequencer } from "./audio/sequencer";
import { ShotMixer } from "./audio/shots";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { STINGERS } from "./audio/stingers";
import { DEFAULT_CONTENT } from "./content";
import type { GameEvent, TowerId } from "./core/types";
// Dev-only page (`/gallery.html?sound`): every effect and instrument, a live music test through the real conductor,
// a shot storm through the real shot mixer, and a review sheet copied out as a markdown table. Offline clips:
// scripts/render-music.ts.

const CRITERIA = [
  ["Clarity", "Can you tell what happened from the sound alone? 1 muddy, 5 instantly"],
  ["Fits the look", "Does it match the glowing sci-fi visuals? 1 out of place, 5 perfect"],
  ["Annoyance after 20×", "Click it about 20 times. 1 grating, 5 still pleasant"],
  ["Loudness vs. others", "1 badly too loud or quiet (say which in the notes), 5 balanced"],
  ["Feels in time", "During the music test: 1 off the beat, 5 locked to it"],
  ["Storm comfort", "During a shot storm of 40 towers: 1 tiring wall of noise, 5 pleasant texture"],
] as const;
const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const MIXES: Record<string, readonly Family[]> = { rapid: ["rapid"], heavy: ["heavy"], mixed: FAMILIES };
const PHASES: readonly Phase[] = ["menu", "build", "wave", "paused", "over"],
  COLUMNS = 16;
const timing = (id: CueId) => {
  const g = TIMING[id].grid;
  return `${g === 0 ? "instant" : g === 1 ? "bar" : g === 4 ? "beat" : `1/${g}`}${STINGERS[id] ? " · instruments" : TIMING[id].pitched ? " · pitched" : ""}`;
};
const slider = (id: string, label: string, max: number, value: number) => `<label>${label} <input id="${id}" type="range" min="0" max="${max}" value="${value}"><output id="${id}-out">${value}</output></label>`;

export function mountSoundBoard(root: HTMLElement) {
  let live: { ctx: AudioContext; engine: AudioEngine; conductor: Conductor; shots: ShotMixer } | null = null,
    timer: ReturnType<typeof setInterval> | null = null;
  const head = `<div class="sb-row sb-head"><span>Sound</span><span>Timing</span>${CRITERIA.map(([c, hint]) => `<span title="${hint}">${c}</span>`).join("")}<span>Notes</span></div>`,
    effects = [...SHOT_CUES, ...COMBAT_CUES, ...FLOW_CUES, ...UI_CUES].map((id) => row(`cue:${id}`, id, timing(id), `cap ${RECIPES[id].cap} · gap ${RECIPES[id].gap}s`)).join(""),
    instruments = (Object.keys(INSTRUMENTS) as Instrument[]).map((name) => row(`instrument:${name}`, name, REGISTER[name] ? "pitched" : "unpitched", "")).join("");
  root.innerHTML = `<style>.sb{display:grid;gap:8px;max-width:1200px}.sb h2{margin:16px 0 4px}.sb-row{display:grid;grid-template-columns:8em 9em repeat(6,7.5em) 1fr;gap:6px;align-items:center}.sb-head span{font-size:11px;color:#8fa6b8}.sb-row small{color:#8fa6b8}.sb dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0}.sb dt{font-weight:600}.sb textarea{width:100%;height:12em}.sb fieldset{display:flex;flex-wrap:wrap;gap:12px;align-items:center}</style>
  <div class="sb"><p><button id="sb-start">Start audio</button> Rate each sound from 1 (bad) to 5 (good); leave a box empty if you have no opinion. Offline clips: <code>npx vite-node scripts/render-music.ts</code>.</p>
  <dl>${CRITERIA.map(([c, hint]) => `<dt>${c}</dt><dd>${hint}</dd>`).join("")}</dl>
  <fieldset><legend>Music test</legend><label>Theme <select id="sb-theme">${Object.keys(MUSIC).map((d) => `<option${d === "outpost" ? " selected" : ""}>${d}</option>`).join("")}</select></label>
  ${slider("sb-level", "Pad %", 100, 60)}<button id="sb-drone-off">Pad off</button><output id="sb-info"></output>
  <label>Phase <select id="sb-phase">${PHASES.map((p) => `<option${p === "wave" ? " selected" : ""}>${p}</option>`).join("")}</select></label>
  ${slider("sb-threat", "Threat %", 100, 40)} ${slider("sb-danger", "Danger %", 100, 20)} ${slider("sb-arc", "Mission %", 100, 30)}
  <label><input id="sb-heavy" type="checkbox"> Heavy enemy</label><label><input id="sb-bossed" type="checkbox"> Boss on the field</label><button id="sb-boss">Boss appears</button>
  <label>Shot storm <select id="sb-mix">${Object.keys(MIXES).map((m) => `<option>${m}</option>`).join("")}</select></label>
  ${slider("sb-towers", "Towers", 60, 12)} ${slider("sb-rate", "Shots/s per tower", 8, 2)}
  <label><input type="radio" name="sb-speed" value="1" checked> 1×</label><label><input type="radio" name="sb-speed" value="2"> 2×</label>
  <button id="sb-play">Play 16 bars</button><button id="sb-stop">Stop</button><output id="sb-out"></output></fieldset>
  <h2>Effects and stingers</h2>${head}${effects}<h2>Instruments</h2>${head}${instruments}
  <p><button id="sb-copy">Copy results</button></p><textarea id="sb-copied" readonly></textarea></div>`;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const value = (id: string) => Number($<HTMLInputElement>(id).value);
  function ready() {
    if (!live) {
      const ctx = new AudioContext(),
        engine = new AudioEngine(ctx),
        conductor = new Conductor(engine);
      engine.volumes({ ...DEFAULT_SETTINGS, muted: false });
      live = { ctx, engine, conductor, shots: new ShotMixer() };
      new Sequencer(() => ctx.currentTime, (from, to) => conductor.window(from, to)).start();
      theme();
    }
    return live;
  }
  function theme() {
    const { ctx, engine, conductor } = ready(),
      drone = $<HTMLSelectElement>("sb-theme").value as DroneId;
    engine.ambience.set({ drone, level: value("sb-level") / 100 });
    conductor.theme(drone, ctx.currentTime);
  }
  /** The music's inputs from the controls, as the game derives them from its phase, the enemies, the reactor and the mission. */
  function measure(playing: boolean) {
    ready().conductor.measure({
      phase: playing ? ($<HTMLSelectElement>("sb-phase").value as Phase) : "paused",
      threat: value("sb-threat") / 100,
      danger: value("sb-danger") / 100,
      arc: value("sb-arc") / 100,
      heavies: $<HTMLInputElement>("sb-heavy").checked ? 1 : 0,
      bosses: $<HTMLInputElement>("sb-bossed").checked ? 1 : 0,
    });
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    measure(false);
  }
  /** 16 bars of music with the shot storm: each tower fires on its own phase, spread over a 16-column board. */
  function play() {
    const { ctx, engine, conductor, shots } = ready();
    stop();
    const families = MIXES[$<HTMLSelectElement>("sb-mix").value],
      shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => {
        const f = familyOf(d);
        return f !== null && families.includes(f);
      }),
      speed = Number(document.querySelector<HTMLInputElement>("[name=sb-speed]:checked")!.value),
      end = ctx.currentTime + (16 * 4 * 60) / conductor.score.clock.bpm,
      owed: number[] = [];
    let kills = 0;
    timer = setInterval(() => {
      const now = ctx.currentTime,
        events: GameEvent[] = [],
        towers = value("sb-towers");
      for (let i = 0; i < towers; i++) {
        owed[i] ??= i / towers;
        for (owed[i] += (value("sb-rate") * speed) / 30; owed[i] >= 1; owed[i]--) {
          const d = shooters[i % shooters.length],
            from = { x: (i * 7) % COLUMNS, y: 0 };
          events.push({ type: "shot", tower: d.id as TowerId, from, to: from, color: d.color });
          if (++kills % 5 === 0) events.push({ type: "kill", at: from, color: d.color, reward: 5 });
        }
      }
      measure(true);
      for (const v of shots.frame(events, DEFAULT_CONTENT, COLUMNS, now)) engine.play({ id: v.id, rate: v.rate, gain: v.gain, at: now, pan: v.pan });
      engine.shotDensity(shots.fired);
      conductor.play(cuesFor(events, DEFAULT_CONTENT, "game"), now);
      $("sb-out").textContent = `${shots.fired.toFixed(1)} shots/s · voices/s ${FAMILIES.map((f) => `${f} ${shots.rate(f).toFixed(1)}`).join(" · ")}`;
      if (now >= end) stop();
    }, 1000 / 30);
  }
  $("sb-start").onclick = () => void ready().ctx.resume();
  $("sb-theme").onchange = theme;
  $("sb-drone-off").onclick = () => ready().engine.ambience.stop();
  $("sb-play").onclick = play;
  $("sb-stop").onclick = stop;
  for (const id of ["sb-heavy", "sb-bossed", "sb-phase"]) $(id).onchange = () => measure(timer !== null);
  $("sb-boss").onclick = () => {
    const { ctx, conductor } = ready();
    conductor.cue("boss", ctx.currentTime);
  };
  for (const id of ["sb-level", "sb-rate", "sb-towers", "sb-threat", "sb-danger", "sb-arc"])
    $<HTMLInputElement>(id).oninput = () => {
      $(`${id}-out`).textContent = String(value(id));
      if (id === "sb-level") theme();
      else measure(timer !== null);
    };
  root.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) => {
    b.onclick = () => {
      const { ctx, engine, conductor } = ready(),
        [kind, name] = b.dataset.play!.split(":");
      if (kind === "cue") conductor.cue(name as CueId, ctx.currentTime);
      else engine.instrument(name as Instrument, REGISTER[name as Instrument] ?? 0, ctx.currentTime, 0.8, 0);
    };
  });
  setInterval(() => {
    if (!live) return;
    const { score } = live.conductor,
      chord = score.chordAt(live.ctx.currentTime).map((n) => NOTES[n % 12]).join(" ");
    $("sb-info").textContent = `${score.clock.bpm} BPM · ${NOTES[score.music.root % 12]} ${score.music.mode} · ${live.conductor.color} · chord ${chord}`;
  }, 200);
  $("sb-copy").onclick = () => {
    const lines = [`| Sound | ${CRITERIA.map(([c]) => c).join(" | ")} | Notes |`, `| --- |${CRITERIA.map(() => " --- |").join("")} --- |`];
    root.querySelectorAll<HTMLElement>(".sb-row[data-id]").forEach((r) => {
      const scores = [...r.querySelectorAll<HTMLSelectElement>("select")].map((s) => s.value || "–");
      lines.push(`| ${r.dataset.id} | ${scores.join(" | ")} | ${r.querySelector<HTMLInputElement>("input")!.value} |`);
    });
    const out = $<HTMLTextAreaElement>("sb-copied");
    out.value = lines.join("\n");
    navigator.clipboard?.writeText(out.value).catch(() => out.select());
  };
}
function row(play: string, label: string, kind: string, hint: string) {
  const select = ([c]: readonly [string, string]) => `<select aria-label="${c} of ${label}"><option></option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select>`;
  return `<div class="sb-row" data-id="${play}"><button data-play="${play}">${label}</button><small title="${hint}">${kind}</small>${CRITERIA.map(select).join("")}<input placeholder="notes"></div>`;
}
