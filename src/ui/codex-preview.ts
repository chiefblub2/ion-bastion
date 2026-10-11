import type { EnemyId } from "../core/types";
import { ANIMATION_STATES, animationsFor, clipDuration, clipFrame, clipUrl, type AnimationClip, type EnemyAnimationState } from "../render/enemy-animations";
import { artFor, artUrl } from "../render/enemy-art";
import { escape } from "./format";
/**
 * Animation preview of an enemy codex card: at most one open at a time, stepping the same sheets and frame timing as
 * the battlefield (`clipFrame`) on one CSS background, with no Phaser and no canvas. It animates only while it is
 * open and playing; closing it, opening another one or re-rendering the codex stops it and drops its elements.
 * With `prefers-reduced-motion: reduce` it opens paused on the first idle frame until the player presses Play.
 */
interface Player {
  id: EnemyId;
  name: string;
  panel: HTMLElement;
  toggle: HTMLElement;
  sprite: HTMLElement;
  state: EnemyAnimationState;
  clip: AnimationClip;
  /** Cells in the loaded sheet (padded to a power of two); 0 until it loaded, -1 when it failed. */
  cells: number;
  playing: boolean;
  /** Seconds into the clip when paused, or the clock origin while playing. */
  elapsed: number;
  startedAt: number;
  frame: number;
  raf: number;
}
let open: Player | undefined;
const LABEL: Record<EnemyAnimationState, string> = { idle: "Idle", move: "Move", hurt: "Hurt", death: "Death" };
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Handles the codex list's preview toggles and controls (event delegation; the list is re-rendered often). */
export function bindCodexPreviews(list: HTMLElement) {
  list.addEventListener("click", (e) => {
    const target = e.target as HTMLElement,
      toggle = target.closest<HTMLElement>("[data-codex-anim]");
    if (toggle) return open?.toggle === toggle ? closeCodexPreview(true) : openPreview(toggle);
    if (!open || !open.panel.contains(target)) return;
    const clip = target.closest<HTMLElement>("[data-anim-clip]")?.dataset.animClip as EnemyAnimationState | undefined;
    if (clip) return showClip(open, clip);
    if (target.closest("[data-anim-play]")) return togglePlay(open);
    if (target.closest("[data-anim-close]")) return closeCodexPreview(true);
  });
  list.addEventListener("keydown", (e) => {
    // Escape closes only the preview; the menu would otherwise leave the codex page too.
    if (e.key === "Escape" && open?.panel.contains(e.target as Node)) {
      e.preventDefault();
      e.stopPropagation();
      closeCodexPreview(true);
    }
  });
}
/** Stops and removes the open preview; `refocus` returns the focus to its toggle. */
export function closeCodexPreview(refocus = false) {
  const p = open;
  if (!p) return;
  open = undefined;
  cancelAnimationFrame(p.raf);
  p.panel.replaceChildren();
  p.panel.hidden = true;
  p.toggle.setAttribute("aria-expanded", "false");
  p.toggle.textContent = "▶";
  if (refocus) p.toggle.focus();
}
function openPreview(toggle: HTMLElement) {
  const id = toggle.dataset.codexAnim as EnemyId,
    set = animationsFor(id),
    panel = document.getElementById(toggle.getAttribute("aria-controls") ?? ""),
    first = set && ANIMATION_STATES.find((s) => set[s]);
  if (!set || !panel || !first) return;
  closeCodexPreview();
  const name = toggle.getAttribute("aria-label")?.replace(/^Animation preview of /, "") ?? id,
    still = artFor(id),
    clips = ANIMATION_STATES.filter((s) => set[s])
      .map((s) => `<button type="button" data-anim-clip="${s}" aria-pressed="false">${LABEL[s]}</button>`)
      .join("");
  panel.innerHTML = `<div class="codex-anim-stage"><div class="codex-sprite" role="img"></div>${still ? `<img class="codex-anim-still" src="${escape(artUrl(still))}" alt="" hidden>` : ""}</div>
    <div class="codex-anim-controls"><div class="codex-anim-clips" role="group" aria-label="Animation">${clips}</div>
    <button type="button" data-anim-play></button><button type="button" data-anim-close aria-label="Close animation preview">✕</button></div>
    <p class="codex-anim-note" aria-live="polite"></p>`;
  panel.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  toggle.textContent = "■";
  open = { id, name, panel, toggle, sprite: panel.querySelector(".codex-sprite")!, state: first, clip: set[first]!, cells: 0, playing: false, elapsed: 0, startedAt: 0, frame: 0, raf: 0 };
  showClip(open, set.idle ? "idle" : first, !reducedMotion());
  if (reducedMotion()) note(open, "Reduced motion is on: press Play to animate.");
}
/** Switches to a clip from its first frame; plays it unless reduced motion holds it (until Play is pressed). */
function showClip(p: Player, state: EnemyAnimationState, play = p.playing || !reducedMotion()) {
  const clip = animationsFor(p.id)?.[state];
  if (!clip) return;
  p.state = state;
  p.clip = clip;
  p.cells = 0;
  p.elapsed = 0;
  p.frame = 0;
  for (const b of p.panel.querySelectorAll<HTMLElement>("[data-anim-clip]")) b.setAttribute("aria-pressed", String(b.dataset.animClip === state));
  const url = clipUrl(clip),
    probe = new Image();
  // The sheet decides the background size (its padded cell count); a sheet that fails shows the static art instead.
  probe.onload = () => {
    if (open !== p || p.clip !== clip) return;
    p.cells = Math.max(1, Math.round(probe.naturalWidth / clip.frameWidth));
    p.sprite.style.backgroundImage = `url("${url}")`;
    p.sprite.style.backgroundSize = `${p.cells * 100}% 100%`;
    note(p, reducedMotion() && !p.playing ? "Reduced motion is on: press Play to animate." : "");
    render(p);
  };
  probe.onerror = () => {
    if (open !== p || p.clip !== clip) return;
    p.cells = -1;
    p.sprite.hidden = true;
    const still = p.panel.querySelector<HTMLImageElement>(".codex-anim-still");
    if (still) still.hidden = false;
    note(p, `The ${LABEL[state].toLowerCase()} animation could not be loaded; showing the static art.`);
    stop(p);
  };
  probe.src = url;
  p.sprite.hidden = false;
  if (play) start(p);
  else stop(p);
}
function togglePlay(p: Player) {
  if (p.playing) return stop(p);
  // A finished one-shot (death, hurt) replays from its start.
  if (!p.clip.loop && p.elapsed >= clipDuration(p.clip)) p.elapsed = 0;
  note(p, "");
  start(p);
}
function start(p: Player) {
  p.playing = true;
  p.startedAt = performance.now() / 1000 - p.elapsed;
  cancelAnimationFrame(p.raf);
  const tick = () => {
    // A codex re-render or closed page drops the panel: stop instead of animating detached elements.
    if (open !== p || !p.panel.isConnected) return cancelAnimationFrame(p.raf);
    p.elapsed = performance.now() / 1000 - p.startedAt;
    if (!p.clip.loop && p.elapsed >= clipDuration(p.clip)) {
      p.elapsed = clipDuration(p.clip);
      render(p);
      return stop(p);
    }
    render(p);
    p.raf = requestAnimationFrame(tick);
  };
  p.raf = requestAnimationFrame(tick);
  controls(p);
}
function stop(p: Player) {
  p.playing = false;
  cancelAnimationFrame(p.raf);
  render(p);
  controls(p);
}
function render(p: Player) {
  const frame = clipFrame(p.clip, p.elapsed);
  if (p.cells > 1 && (frame !== p.frame || !p.sprite.style.backgroundPositionX)) p.sprite.style.backgroundPositionX = `${(frame / (p.cells - 1)) * 100}%`;
  p.frame = frame;
  p.sprite.setAttribute("aria-label", `${p.name}, ${LABEL[p.state].toLowerCase()} animation, frame ${frame + 1} of ${p.clip.frames}`);
}
function controls(p: Player) {
  const play = p.panel.querySelector<HTMLElement>("[data-anim-play]");
  if (!play) return;
  const done = !p.clip.loop && p.elapsed >= clipDuration(p.clip);
  play.textContent = p.playing ? "Pause" : done ? "Replay" : "Play";
  play.toggleAttribute("disabled", p.cells < 0);
}
function note(p: Player, text: string) {
  const n = p.panel.querySelector<HTMLElement>(".codex-anim-note");
  if (n && n.textContent !== text) n.textContent = text;
}
