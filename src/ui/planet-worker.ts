import { paintSurface, paintWrapped, type SurfaceSeed } from "./planet-surface";
import type { Box } from "./world-map";
/** Paints planet surfaces off the main thread (`planet-texture.ts`): one job per message, answered with an image. */
export interface SurfaceJob {
  id: number;
  seeds: SurfaceSeed[];
  box: Box;
  width: number;
  height: number;
  /** Paints a picture that wraps in x (`paintWrapped`), blending this many plane units. */
  wrap?: number;
}
const scope = self as unknown as { onmessage: ((e: MessageEvent<SurfaceJob>) => void) | null; postMessage(message: unknown): void };
/**
 * Jobs run one after another, each answered before the next starts: an answer waits for its picture's encoding, and
 * a long job started meanwhile would hold back the quick ones queued before it.
 */
let queue = Promise.resolve();
scope.onmessage = ({ data }) => {
  queue = queue.then(() => run(data));
};
async function run({ id, seeds, box, width, height, wrap }: SurfaceJob) {
  try {
    const canvas = new OffscreenCanvas(width, height),
      pixels = wrap ? paintWrapped(seeds, box, width, height, wrap) : paintSurface(seeds, box, width, height);
    canvas.getContext("2d")!.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
    scope.postMessage({ id, blob: await canvas.convertToBlob({ type: "image/webp", quality: 0.9 }) });
  } catch (error) {
    scope.postMessage({ id, error: String(error) });
  }
}
