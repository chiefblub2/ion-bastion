import type { SurfaceSeed } from "./planet-surface";
import type { SurfaceJob } from "./planet-worker";
import type { Box } from "./world-map";
/**
 * Planet surface pictures for the Sector Atlas: `paintSurface` runs in a worker, created on the first request, and
 * each picture comes back as an image URL, cached per request. Rejects where workers or OffscreenCanvas are missing
 * (the territories keep their flat ground colours).
 */
let worker: Worker | null = null,
  next = 0;
const waiting = new Map<number, { resolve: (url: string) => void; reject: (error: Error) => void }>(),
  cache = new Map<string, Promise<string>>();
function start() {
  if (worker) return worker;
  worker = new Worker(new URL("./planet-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
    const job = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.blob) job?.resolve(URL.createObjectURL(data.blob));
    else job?.reject(new Error(data.error ?? "No surface"));
  };
  worker.onerror = () => {
    for (const job of waiting.values()) job.reject(new Error("Surface worker failed"));
    waiting.clear();
  };
  return worker;
}
/** An image URL of the surface in `box` (world units) at `width` × `height` pixels; `wrap` makes it seamless in x. */
export function surfaceImage(seeds: readonly SurfaceSeed[], box: Box, width: number, height: number, wrap?: number): Promise<string> {
  const key = JSON.stringify([seeds, box, width, height, wrap]);
  let image = cache.get(key);
  if (!image) {
    image =
      typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined"
        ? Promise.reject(new Error("No worker canvas"))
        : new Promise<string>((resolve, reject) => {
            const id = next++,
              job: SurfaceJob = { id, seeds: [...seeds], box, width, height, wrap };
            waiting.set(id, { resolve, reject });
            start().postMessage(job);
          });
    image.catch(() => cache.delete(key));
    cache.set(key, image);
  }
  return image;
}
