import type { EnemyId } from "../core/types";
import { artFor, artUrl } from "../render/enemy-art";
import { escape } from "./format";
/**
 * Painted enemy icons for the DOM (codex, wave forecast, mission brief, live units, enemy details), from the same
 * PNGs as the battlefield. The procedural SVG stays inside as the fallback: it shows only when the image fails to
 * load (`installEnemyArtFallback`) or the type has no art. Static by default; only the codex preview animates.
 */
export function paintedIcon(type: EnemyId, fallbackSvg: string, base?: string): string {
  const art = artFor(type);
  if (!art) return fallbackSvg;
  const b = art.bounds,
    // The visible art fills the icon: scaled by its longest visible side and re-centred on its visible bounds.
    k = b ? 1 / Math.max(b.w, b.h) : 1,
    dx = b ? -b.x * 100 : 0,
    dy = b ? -b.y * 100 : 0,
    style = `--art-k:${k.toFixed(3)};--art-dx:${dx.toFixed(1)}%;--art-dy:${dy.toFixed(1)}%`;
  return `<span class="enemy-icon painted" style="${style}"><img src="${escape(artUrl(art, base))}" alt="" width="64" height="64" decoding="async" loading="lazy" draggable="false">${fallbackSvg}</span>`;
}
let installed = false;
/**
 * Swaps a painted icon whose image failed for its procedural SVG, once for the whole document (`error` events do not
 * bubble, so the listener captures). Never resized: the icon box keeps its size, so the layout does not shift.
 */
export function installEnemyArtFallback(doc: Document = document) {
  if (installed) return;
  installed = true;
  doc.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img instanceof HTMLImageElement && img.parentElement?.classList.contains("painted")) img.parentElement.classList.add("failed");
    },
    true,
  );
}
