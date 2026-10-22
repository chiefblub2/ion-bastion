import Phaser from "phaser";
import type { MapDefinition } from "../core/types";
import { CELL } from "./shapes";
import { drawAmbient, drawTerrain } from "./terrain";
/**
 * Battlefield pictures for the mission page: the real static terrain (`drawTerrain`) of a map, rendered once into an
 * image URL. One small canvas-renderer Phaser game, created on the first request and asleep between jobs, draws
 * every map in turn; the battlefield's own game stays untouched.
 */
let booting: Promise<Phaser.Scene> | null = null,
  queue: Promise<unknown> = Promise.resolve();
// Keyed by the map object, not its id: a playtest or draft map may reuse a real map's id.
const cache = new WeakMap<MapDefinition, Promise<string>>();
function boot() {
  return (booting ??= new Promise<Phaser.Scene>((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-20000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none";
    document.body.append(host);
    new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host,
      width: CELL,
      height: CELL,
      backgroundColor: "#05070f",
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scene: class extends Phaser.Scene {
        create() {
          resolve(this);
        }
      },
    });
  }));
}
async function render(map: MapDefinition) {
  const scene = await boot(),
    game = scene.game,
    width = map.columns * CELL,
    height = map.rows * CELL,
    blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`));
  game.loop.wake();
  try {
    scene.children.removeAll(true);
    game.scale.resize(width, height);
    scene.cameras.resize(width, height);
    drawTerrain(scene, map, (x, y) => blocked.has(`${x},${y}`));
    // One still frame of the animated layer, so beacons, glows and landmark lights show too.
    const ambient = scene.add.graphics();
    drawAmbient(ambient, ambient, map, 0);
    await new Promise((done) => game.events.once(Phaser.Core.Events.POST_RENDER, done));
    const blob = await new Promise<Blob | null>((done) => game.canvas.toBlob(done, "image/webp", 0.86));
    if (!blob) throw new Error(`No snapshot of map ${map.id}`);
    return URL.createObjectURL(blob);
  } finally {
    scene.children.removeAll(true);
    game.loop.sleep();
  }
}
/** An image URL of the map's terrain, cached per map object; rejects where the canvas is unavailable (keep a fallback). */
export function terrainImage(map: MapDefinition): Promise<string> {
  let image = cache.get(map);
  if (!image) {
    // One job at a time: the scene holds a single map.
    image = queue.then(() => render(map));
    queue = image.catch(() => undefined);
    cache.set(map, image);
  }
  return image;
}
