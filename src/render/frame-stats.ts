/**
 * Dev-only frame timings for `scripts/frame-bench.ts` (`window.__frameStats`): per frame, the simulation step
 * (`driver.advance`), the scene's own drawing (`Battlefield.draw` and the sprites) and Phaser's render pass, in ms.
 * Never read by the game; the hook that creates it is stripped from `vite build`.
 */
export type FrameStage = "sim" | "draw" | "render";
const SAMPLES = 600;
export class FrameStats {
  private samples: Record<FrameStage, number[]> = { sim: [], draw: [], render: [] };
  private frames: number[] = [];
  private last = 0;
  add(stage: FrameStage, ms: number) {
    const list = this.samples[stage];
    list.push(ms);
    if (list.length > SAMPLES) list.shift();
  }
  /** Called once per rendered frame: the interval since the previous frame. */
  tick(now: number) {
    if (this.last) {
      this.frames.push(now - this.last);
      if (this.frames.length > SAMPLES) this.frames.shift();
    }
    this.last = now;
  }
  reset() {
    this.samples = { sim: [], draw: [], render: [] };
    this.frames = [];
    this.last = 0;
  }
  summary() {
    const stat = (list: number[]) => {
      const sorted = [...list].sort((a, b) => a - b),
        avg = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
      return { avg: round(avg), p95: round(sorted[Math.floor(sorted.length * 0.95)] ?? 0) };
    };
    const frame = stat(this.frames);
    return { frames: this.frames.length, fps: round(frame.avg ? 1000 / frame.avg : 0), frame, sim: stat(this.samples.sim), draw: stat(this.samples.draw), render: stat(this.samples.render) };
  }
}
const round = (n: number) => Math.round(n * 100) / 100;
