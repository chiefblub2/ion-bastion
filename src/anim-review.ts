import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { Game } from "./core/game";
import type { EnemyId } from "./core/types";
import { ANIMATION_STATES, animationArt, animationsFor, clipFrame, ENEMY_ANIMATIONS, sheetFrame, type EnemyAnimationState } from "./render/enemy-animations";
import { artFor } from "./render/enemy-art";
import { queueEnemyAnimations, queueEnemyArt } from "./render/enemy-art-scene";
import { placeArt } from "./render/enemy-sprites";
import { enemyContext } from "./render/enemies";
import { CELL } from "./render/shapes";
import { createEnemy } from "./systems/spawn";
import { statusFlags } from "./systems/status";
import { traitFlags } from "./systems/traits";
// Dev-only animation QA (`/gallery.html?anim`, not part of `vite build`): one animated enemy and clip at a time.
//
//   large cells    the frame at its full 256 px cell on dark and on light ground; `bounds` outlines the cell (frame
//                  boundary), the resting-body bounds (`ANIMATION_BOUNDS`) and the pivot (cell centre)
//   game size      the frame placed exactly as on the battlefield (`placeArt` with `animationArt`: static scale,
//                  pose, lift) at four headings, next to the static art, with the body radius ring, at `&zoom`
//   filmstrip      every frame of the clip side by side, with the pivot cross: drift, size jumps, a loop seam and a
//                  death that ends abruptly show at a glance
//
// Controls (DOM bar above the canvas, keyboard in brackets): enemy, clip, play/pause [space], step back and forward
// [← →], speed, bounds and pivot [b], light page background [l]. Query: `&id=<enemy>&clip=<state>&frame=<n>`
// (paused on that frame), `&zoom=<z>` (game size, default 2 like a HiDPI screen), `&bounds=0`. A clip whose sheet
// did not load is marked unavailable; `window.__animReview` exposes `ready` and the current selection for scripts.

const params = new URLSearchParams(location.search),
  IDS = Object.keys(ENEMY_ANIMATIONS) as EnemyId[],
  GAME_ZOOM = Number(params.get("zoom") ?? 2);
const BIG = 256,
  PAD = 16,
  STRIP = 104,
  TILE = 120;
export const animReviewSize = { width: PAD * 3 + BIG * 2 + 5 * (TILE + 8), height: PAD * 4 + BIG + 24 + STRIP + 40 };
interface Selection {
  id: EnemyId;
  clip: EnemyAnimationState;
  playing: boolean;
  speed: number;
  elapsed: number;
  bounds: boolean;
}
const sel: Selection = {
  id: IDS.includes(params.get("id") as EnemyId) ? (params.get("id") as EnemyId) : IDS[0],
  clip: (ANIMATION_STATES as readonly string[]).includes(params.get("clip") ?? "") ? (params.get("clip") as EnemyAnimationState) : "idle",
  playing: !params.has("frame"),
  speed: 1,
  elapsed: 0,
  bounds: params.get("bounds") !== "0",
};

export class AnimReview extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  private images: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private status?: HTMLElement;
  /** A real spawn of the selected type (shield, size), made once per layout. */
  private unit?: { sim: Game; e: ReturnType<typeof createEnemy> };
  preload() {
    queueEnemyArt(this);
    queueEnemyAnimations(this);
  }
  create() {
    this.g = this.add.graphics().setDepth(0);
    this.marks = this.add.graphics().setDepth(2);
    const clip = animationsFor(sel.id)?.[sel.clip];
    if (clip && params.has("frame")) sel.elapsed = (Number(params.get("frame")) - 1 + 0.5) / clip.fps;
    this.controls();
    this.layout();
    (window as unknown as { __animReview: object }).__animReview = { ready: true, sel };
  }
  override update(_time: number, delta: number) {
    if (sel.playing) {
      sel.elapsed += (delta / 1000) * sel.speed;
      this.frames();
    }
  }
  /** Rebuilds every object for the current enemy and clip. */
  private layout() {
    for (const o of [...this.images, ...this.labels]) o.destroy();
    this.images = [];
    this.labels = [];
    const g = this.g,
      clip = animationsFor(sel.id)?.[sel.clip],
      ok = clip && this.textures.exists(clip.texture),
      stat = artFor(sel.id);
    const sim = new Game();
    this.unit = { sim, e: createEnemy(sim, sel.id, 0.5) };
    g.clear();
    const label = (x: number, y: number, text: string, color = "#9fb4c0") => this.labels.push(this.add.text(x, y, text, { fontFamily: "monospace", fontSize: "12px", color }).setDepth(3));
    // Large cells on dark and light ground.
    for (const [i, ground] of [0x0d1820, 0xd9d2bf].entries()) {
      const x = PAD + i * (BIG + PAD);
      g.fillStyle(ground).fillRect(x, PAD + 18, BIG, BIG);
      label(x, PAD, i ? "light ground, full cell" : "dark ground, full cell");
      if (ok) this.images.push(this.add.image(x + BIG / 2, PAD + 18 + BIG / 2, clip.texture, sheetFrame(clip, 0)).setDepth(1));
    }
    // Game size: four headings and the static art.
    const gx = PAD * 3 + BIG * 2,
      gy = PAD + 18;
    label(gx, PAD, `game size ×${GAME_ZOOM}: headings 0° 90° 180° 270°, static art`);
    for (let i = 0; i < 5; i++) {
      const x = gx + i * (TILE + 8);
      g.fillStyle(i % 2 ? 0x24333d : 0x1c2a33).fillRect(x, gy, TILE, TILE);
      g.fillStyle(0x31424d).fillRect(x, gy + TILE / 2 - 14, TILE, 28);
      const tex = i < 4 ? (ok ? clip.texture : undefined) : stat && this.textures.exists(stat.texture) ? stat.texture : undefined;
      if (tex) this.images.push(this.add.image(0, 0, tex, i < 4 && clip ? sheetFrame(clip, 0) : undefined).setDepth(1));
      else label(x + 6, gy + TILE / 2 - 6, "unavailable", "#ff8b8b");
    }
    label(gx, gy + TILE + 6, "static", "#9fb4c0");
    // Filmstrip.
    const sy = PAD * 2 + 18 + BIG + 18;
    label(PAD, sy - 16, "filmstrip: every frame, pivot cross");
    if (clip)
      for (let f = 0; f < clip.frames; f++) {
        const x = PAD + f * (STRIP + 6);
        g.fillStyle(0x0d1820).fillRect(x, sy, STRIP, STRIP);
        if (ok) this.images.push(this.add.image(x + STRIP / 2, sy + STRIP / 2, clip.texture, sheetFrame(clip, f)).setDisplaySize(STRIP, STRIP).setDepth(1));
        label(x + 3, sy + STRIP + 2, `${f + 1}`);
      }
    if (!ok) label(PAD + 8, PAD + 30, clip ? `${clip.texture}: not loaded (falls back to other clips or static art)` : `${sel.id} has no ${sel.clip} clip`, "#ff8b8b");
    this.frames();
  }
  /** Shows the current frame on the large and game-size images, with the marks. */
  private frames() {
    const clip = animationsFor(sel.id)?.[sel.clip],
      m = this.marks;
    m.clear();
    if (!clip) return this.report();
    const frame = clipFrame(clip, sel.elapsed),
      ok = this.textures.exists(clip.texture);
    if (!clip.loop && sel.elapsed >= clip.frames / clip.fps && sel.playing) sel.playing = false;
    const art = animationArt(sel.id)!,
      stat = artFor(sel.id),
      definition = DEFAULT_CONTENT.enemies[sel.id],
      { sim, e } = this.unit!;
    let n = 0;
    if (ok)
      for (let i = 0; i < 2; i++) {
        const img = this.images[n++];
        img.setFrame(sheetFrame(clip, frame));
        if (sel.bounds) {
          const x = PAD + i * (BIG + PAD),
            y = PAD + 18,
            b = art.bounds!;
          m.lineStyle(1, 0xff4fd8, 0.9).strokeRect(x, y, BIG, BIG);
          m.lineStyle(1, 0x5fe0ff, 0.9).strokeRect(x + (0.5 + b.x - b.w / 2) * BIG, y + (0.5 + b.y - b.h / 2) * BIG, b.w * BIG, b.h * BIG);
          m.lineStyle(1, 0xffe14f, 1).lineBetween(x + BIG / 2 - 8, y + BIG / 2, x + BIG / 2 + 8, y + BIG / 2).lineBetween(x + BIG / 2, y + BIG / 2 - 8, x + BIG / 2, y + BIG / 2 + 8);
        }
      }
    const gx = PAD * 3 + BIG * 2,
      gy = PAD + 18;
    for (let i = 0; i < 5; i++) {
      const animated = i < 4;
      if (animated ? !ok : !(stat && this.textures.exists(stat.texture))) continue;
      const heading = animated ? (i * Math.PI) / 2 : 0,
        cx = gx + i * (TILE + 8) + TILE / 2,
        cy = gy + TILE / 2,
        c = enemyContext(0, 0, CELL, e, definition, heading, statusFlags(e, 0), { ...traitFlags(sim, e), revealed: true }, 0),
        at = placeArt(c, animated ? art : stat!),
        img = this.images[n++];
      if (animated) img.setFrame(sheetFrame(clip, frame));
      img.setPosition(cx + at.x * GAME_ZOOM, cy + at.y * GAME_ZOOM).setRotation(at.rotation).setDisplaySize(at.size * GAME_ZOOM, at.size * GAME_ZOOM).setFlip(at.flipX, at.flipY);
      if (sel.bounds) {
        m.lineStyle(1, 0xffffff, 0.7).strokeCircle(cx, cy, c.r * GAME_ZOOM);
        m.lineStyle(1, 0xffe14f, 1).lineBetween(cx - 4, cy, cx + 4, cy).lineBetween(cx, cy - 4, cx, cy + 4);
      }
    }
    if (sel.bounds) {
      const sy = PAD * 2 + 18 + BIG + 18;
      for (let f = 0; f < clip.frames; f++) {
        const x = PAD + f * (STRIP + 6) + STRIP / 2,
          y = sy + STRIP / 2;
        m.lineStyle(1, f === frame ? 0xffe14f : 0x506570, 1).strokeRect(x - STRIP / 2, sy, STRIP, STRIP);
        m.lineStyle(1, 0xffe14f, 0.8).lineBetween(x - 5, y, x + 5, y).lineBetween(x, y - 5, x, y + 5);
      }
    }
    this.report(frame);
  }
  private report(frame = 0) {
    const clip = animationsFor(sel.id)?.[sel.clip];
    if (!this.status) return;
    this.status.textContent = clip
      ? `${sel.id}/${sel.clip} · frame ${frame + 1}/${clip.frames} · ${clip.fps} fps × ${sel.speed} · ${clip.frameWidth}×${clip.frameHeight} px cells · sheet frames ${clip.start}–${clip.start + clip.frames - 1} · ${clip.loop ? "loop" : "once"} · ${this.textures.exists(clip.texture) ? "loaded" : "UNAVAILABLE"}`
      : `${sel.id}: no ${sel.clip} clip`;
  }
  /** The DOM control bar above the canvas. */
  private controls() {
    const bar = document.createElement("div");
    bar.className = "anim-controls";
    const options = (values: readonly string[], value: string) => values.map((v) => `<option${v === value ? " selected" : ""}>${v}</option>`).join("");
    bar.innerHTML = `<label>Enemy <select data-k="id">${options(IDS, sel.id)}</select></label>
      <label>Clip <select data-k="clip">${options(ANIMATION_STATES, sel.clip)}</select></label>
      <button data-k="back" title="Previous frame (←)">◀ frame</button><button data-k="play" title="Play/pause (space)"></button><button data-k="next" title="Next frame (→)">frame ▶</button>
      <label>Speed <select data-k="speed">${options(["0.25", "0.5", "1", "2"], "1")}</select></label>
      <label><input type="checkbox" data-k="bounds"${sel.bounds ? " checked" : ""}> bounds and pivot (b)</label>
      <label><input type="checkbox" data-k="light"> light page (l)</label>
      <output></output>`;
    document.getElementById("gallery")!.before(bar);
    this.status = bar.querySelector("output")!;
    const play = bar.querySelector<HTMLButtonElement>('[data-k="play"]')!,
      sync = () => (play.textContent = sel.playing ? "❚❚ pause" : "▶ play");
    const step = (d: number) => {
      const clip = animationsFor(sel.id)?.[sel.clip];
      if (!clip) return;
      sel.playing = false;
      const f = (clipFrame(clip, sel.elapsed) + d + clip.frames) % clip.frames;
      sel.elapsed = (f + 0.5) / clip.fps;
      sync();
      this.frames();
    };
    const toggle = () => {
      const clip = animationsFor(sel.id)?.[sel.clip];
      if (clip && !clip.loop && sel.elapsed >= clip.frames / clip.fps) sel.elapsed = 0;
      sel.playing = !sel.playing;
      sync();
    };
    bar.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement & HTMLSelectElement;
      if (t.dataset.k === "id" || t.dataset.k === "clip") {
        sel[t.dataset.k as "id"] = t.value as EnemyId;
        sel.elapsed = 0;
        sel.playing = true;
        sync();
        this.layout();
      } else if (t.dataset.k === "speed") sel.speed = Number(t.value);
      else if (t.dataset.k === "bounds") {
        sel.bounds = t.checked;
        this.frames();
      } else if (t.dataset.k === "light") document.body.style.background = t.checked ? "#e9e4d6" : "";
    });
    bar.addEventListener("click", (e) => {
      const k = (e.target as HTMLElement).dataset.k;
      if (k === "play") toggle();
      if (k === "back") step(-1);
      if (k === "next") step(1);
    });
    addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).tagName === "SELECT") return;
      if (e.key === " ") toggle();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "b") bar.querySelector<HTMLInputElement>('[data-k="bounds"]')!.click();
      else if (e.key === "l") bar.querySelector<HTMLInputElement>('[data-k="light"]')!.click();
      else return;
      e.preventDefault();
    });
    sync();
  }
}
