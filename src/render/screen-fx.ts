import Phaser from "phaser";
import type { GameEvent } from "../core/types";
/** Seconds the screen stays tinted after the reactor takes a hit. */
const LEAK_FLASH = 0.45;
/** Seconds after a flash before the next reactor hit flashes again. */
const LEAK_GAP = 0.6;
/**
 * Phaser 4 filters on top of the drawn board, render only and WebGL only (the canvas renderer has no filters, so it
 * keeps the plain look): a bloom that spreads the additive light of the glow layers into a soft falloff, a red,
 * desaturated flash when the reactor is hit and a short shake under an orbital strike. Each costs full-screen passes,
 * so `setEnabled(false)` (the Glow effects setting) turns them all off.
 */
export class ScreenFx {
  private blooms: { layer: Phaser.GameObjects.Graphics; filters: Phaser.Filters.ParallelFilters; blur: Phaser.Filters.Blur }[] = [];
  private flash?: Phaser.Filters.ColorMatrix;
  /** Effect-clock time the last reactor hit ends; strength is how hard it was. */
  private leak = { until: 0, strength: 0 };
  private enabled = true;
  constructor(
    private scene: Phaser.Scene,
    /** Reduced motion: no flashes and no shake. */
    private still: () => boolean,
  ) {}
  /** Whether the renderer can run filters at all. */
  get supported() {
    return this.scene.renderer.type === Phaser.WEBGL;
  }
  /** Adds the bloom to an additive layer; `zoom` (canvas pixels per world pixel) keeps the spread the same in world units. */
  bloom(layer: Phaser.GameObjects.Graphics, zoom: number) {
    if (!this.supported) return;
    const [bloom] = Phaser.Actions.AddEffectBloom(layer, { threshold: 0, blurRadius: 2, blurSteps: 2, blurQuality: 0, blendAmount: 0.75 });
    // The layer is light only: every pixel blooms, so the threshold pass is skipped.
    bloom.threshold.active = false;
    bloom.parallelFilters.active = this.enabled;
    this.blooms.push({ layer, filters: bloom.parallelFilters, blur: bloom.blur });
    this.setZoom(zoom);
  }
  setZoom(zoom: number) {
    for (const { blur } of this.blooms) blur.x = blur.y = 2 * Math.max(1, zoom);
  }
  /**
   * Fills a bloomed layer with opaque black before its light. Phaser's ADD is (ONE, DST_ALPHA): in the filter's
   * transparent framebuffer, overlapping light would add only as much as the alpha already there, so stacked halos
   * came out dim. On black (alpha 1) light adds exactly as on the board, and black adds nothing when composited.
   */
  prime(layer: Phaser.GameObjects.Graphics, width: number, height: number) {
    if (this.enabled && this.blooms.length) layer.fillStyle(0x000000, 1).fillRect(0, 0, width, height);
  }
  setEnabled(on: boolean) {
    this.enabled = on;
    for (const { filters } of this.blooms) filters.active = on;
    if (!on && this.flash) this.flash.active = false;
  }
  /** Reads the frame's drained events; never changes them. */
  consume(events: readonly GameEvent[], now: number) {
    if (!this.enabled || !this.supported || this.still()) return;
    for (const e of events) {
      // A crowd leaking one after another flashes once a second, not into a board that stays grey.
      if (e.type === "leak" && now > this.leak.until + LEAK_GAP) this.leak = { until: now + LEAK_FLASH, strength: Math.min(1, 0.55 + 0.15 * e.amount) };
      else if (e.type === "strike") this.scene.cameras.main.shake(140, 0.004);
    }
  }
  /** Fades the flash on the effect clock (frozen while paused). */
  update(now: number) {
    const k = this.enabled && this.leak.until > now ? ((this.leak.until - now) / LEAK_FLASH) * this.leak.strength : 0;
    if (k <= 0) {
      if (this.flash) this.flash.active = false;
      return;
    }
    // The camera filter costs a full-screen pass, so it only exists while a flash runs.
    this.flash ??= this.scene.cameras.main.filters.external.addColorMatrix();
    this.flash.active = true;
    this.flash.colorMatrix.reset();
    this.flash.colorMatrix.saturate(-0.6 * k, true);
    // Red up, green and blue down: the board goes the colour of an alarm.
    this.flash.colorMatrix.multiply([1 + 0.35 * k, 0, 0, 0, 0, 0, 1 - 0.25 * k, 0, 0, 0, 0, 0, 1 - 0.25 * k, 0, 0, 0, 0, 0, 1, 0], true);
  }
  reset() {
    this.blooms = [];
    this.flash = undefined;
    this.leak = { until: 0, strength: 0 };
  }
}
