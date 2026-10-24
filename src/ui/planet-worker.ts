import { paintSurface, type SurfaceSeed } from "./planet-surface";
import type { Box } from "./world-map";
/** Paints planet surfaces off the main thread (`planet-texture.ts`): one job per message, answered with an image. */
export interface SurfaceJob {
  id: number;
  seeds: SurfaceSeed[];
  box: Box;
  width: number;
  height: number;
}
const scope = self as unknown as { onmessage: ((e: MessageEvent<SurfaceJob>) => void) | null; postMessage(message: unknown): void };
scope.onmessage = async ({ data: { id, seeds, box, width, height } }) => {
  try {
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d")!.putImageData(new ImageData(paintSurface(seeds, box, width, height) as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
    scope.postMessage({ id, blob: await canvas.convertToBlob({ type: "image/webp", quality: 0.9 }) });
  } catch (error) {
    scope.postMessage({ id, error: String(error) });
  }
};
