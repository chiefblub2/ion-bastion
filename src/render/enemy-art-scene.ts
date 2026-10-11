import Phaser from "phaser";
import { allClips, clipError, clipUrl } from "./enemy-animations";
import { artUrl, ENEMY_ART } from "./enemy-art";
import type { SpriteHost } from "./enemy-sprites";
/**
 * The Phaser side of painted enemy bodies, shared by the battlefield and the dev-only art review page
 * (`/gallery.html?art`), so both load and show the art the same way.
 */

/** Art textures that failed to load: never queued again (their enemies stay procedural) and warned about once. */
const failedArt = new Set<string>();
/** Queues the enemy art in a scene's `preload`, once per game; a scene restart finds it in the texture cache. */
export function queueEnemyArt(scene: Phaser.Scene) {
  const queued = Object.values(ENEMY_ART).filter((art) => !scene.textures.exists(art.texture) && !failedArt.has(art.texture));
  for (const art of queued) scene.load.image(art.texture, artUrl(art));
  // A missing file and an undecodable one both end without a texture (only the first raises FILE_LOAD_ERROR).
  if (queued.length)
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const art of queued)
        if (!scene.textures.exists(art.texture)) {
          failedArt.add(art.texture);
          console.warn(`Enemy art '${art.texture}' (${artUrl(art)}) did not load; those enemies keep their procedural body.`);
        }
    });
}
/**
 * Queues the enemy animation sheets in a scene's `preload` (each a spritesheet of square cells), once per game like
 * the art. A clip that fails to load or is invalid is warned about once and never queued again; its enemies fall
 * back clip by clip (`animate`), then to the static art. Frames are picked per Image from the effect clock
 * (`EnemySprites`), so no Phaser animation definitions are needed: Phaser's own playback runs on the game loop and
 * would not freeze with a paused game (`AnimationManager.pauseAll` does not stop sprites in Phaser 3.90).
 */
export function queueEnemyAnimations(scene: Phaser.Scene) {
  const queued = allClips().filter((clip) => {
    if (scene.textures.exists(clip.texture) || failedArt.has(clip.texture)) return false;
    const problem = clipError(clip);
    if (!problem) return true;
    failedArt.add(clip.texture);
    console.warn(`Enemy animation '${clip.texture}' is invalid (${problem}); those enemies fall back to their other clips or static art.`);
    return false;
  });
  // `endFrame` stops at the last drawn cell; the sheets are padded to a power-of-two width with empty cells.
  for (const clip of queued) scene.load.spritesheet(clip.texture, clipUrl(clip), { frameWidth: clip.frameWidth, frameHeight: clip.frameHeight, endFrame: clip.frames - 1 });
  if (queued.length)
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const clip of queued)
        if (!scene.textures.exists(clip.texture)) {
          failedArt.add(clip.texture);
          console.warn(`Enemy animation '${clip.texture}' (${clipUrl(clip)}) did not load; those enemies fall back to their other clips or static art.`);
        }
    });
}
/** Texture lookups and Images of a scene, for `EnemySprites`. */
export const sceneSpriteHost = (scene: Phaser.Scene): SpriteHost => ({
  hasTexture: (key) => !failedArt.has(key) && scene.textures.exists(key),
  createImage: (key, frame) => scene.add.image(0, 0, key, frame),
  canTint: () => scene.sys.game.renderer.type === Phaser.WEBGL,
});
/**
 * WebGL texture filtering for the game config. The art is 256 px (the boss 512 px) and is shown at 20 to 60 world
 * pixels, so the GPU minifies it 4 to 12 times. Phaser already builds mipmaps for every power-of-two texture, but
 * samples them only with `LINEAR` unless a mipmap filter is set; plain bilinear then skips most texels and the art
 * shimmers while it moves and turns. Trilinear filtering reads the matching mip level. It changes only power-of-two
 * textures (the enemy art and Phaser's tiny built-in ones), so graphics, text and the canvas renderer are unaffected.
 */
export const ART_FILTERING = { mipmapFilter: "LINEAR_MIPMAP_LINEAR" } as const;
