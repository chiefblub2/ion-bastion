import Phaser from "phaser";
import type { EnemyId } from "../core/types";
import { allClips, ANIMATION_COLUMNS, ANIMATION_ROWS, clipError, clipUrl, sheetPlan } from "./enemy-animations";
import { artUrl, ENEMY_ART } from "./enemy-art";
import type { SpriteHost } from "./enemy-sprites";
/**
 * The Phaser side of painted enemy bodies, shared by the battlefield and the dev-only art review page
 * (`/gallery.html?art`), so both load and show the art the same way.
 */

/** Art textures that failed to load: never queued again (their enemies stay procedural) and warned about once. */
const failedArt = new Set<string>();
/**
 * Queues the static enemy art. With `types` (the battlefield passes `missionEnemyTypes`, from `create`, loading in
 * the background like the sheets) only those textures load and the loaded art of every other type is released, so a
 * mission holds its own few textures instead of all of them; without (review pages, in `preload`) everything loads.
 * Until a texture arrives its enemies keep the procedural body. A texture already loaded is reused.
 */
export function queueEnemyArt(scene: Phaser.Scene, types?: ReadonlySet<EnemyId>) {
  const wanted = types && new Set([...types].flatMap((type) => (ENEMY_ART[type] ? [ENEMY_ART[type].texture] : [])));
  if (wanted) for (const art of Object.values(ENEMY_ART)) if (!wanted.has(art.texture) && scene.textures.exists(art.texture)) scene.textures.remove(art.texture);
  const queued = Object.values(ENEMY_ART).filter((art) => (!wanted || wanted.has(art.texture)) && !scene.textures.exists(art.texture) && !failedArt.has(art.texture));
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
 * Queues the enemy animation sheets (one grid spritesheet per animated type, its clips on the rows): in `preload` on
 * the review pages, in `create` plus `load.start()` on the battlefield, which runs while they load. With `types` (the battlefield passes `missionAnimationTypes`), only those sheets are queued and loaded sheets
 * of other types are released: each decodes to 8 MiB (2048 × 1024 RGBA, more with mipmaps), so the whole roster
 * would not fit a mission's budget. This runs again on every mission change (`scene.restart`) after the old
 * Images are destroyed, so nothing still shows a released sheet; a sheet kept from the last mission is reused.
 * Without `types` (review pages) every sheet loads. A sheet that fails to load, or holds an invalid clip, is warned
 * about once and never queued again; its enemies keep their static art, as do types whose sheet is not loaded.
 * Frames are picked per Image from the effect clock (`EnemySprites`), so no Phaser animation definitions are needed:
 * Phaser's own playback runs on the game loop and would not freeze with a paused game (`AnimationManager.pauseAll`
 * does not stop sprites in Phaser 3.90).
 */
export function queueEnemyAnimations(scene: Phaser.Scene, types?: ReadonlySet<EnemyId>) {
  for (const clip of allClips()) {
    const problem = clipError(clip);
    if (!problem || failedArt.has(clip.texture)) continue;
    failedArt.add(clip.texture);
    console.warn(`Enemy animation sheet '${clip.texture}' has an invalid clip (${problem}); those enemies keep their static art.`);
  }
  const plan = sheetPlan(types, (key) => scene.textures.exists(key));
  for (const key of plan.release) scene.textures.remove(key);
  const queued = plan.load.filter((sheet) => !failedArt.has(sheet.texture));
  for (const sheet of queued)
    scene.load.spritesheet(sheet.texture, clipUrl(sheet), { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight, endFrame: ANIMATION_COLUMNS * ANIMATION_ROWS - 1 });
  if (queued.length)
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const sheet of queued)
        if (!scene.textures.exists(sheet.texture)) {
          failedArt.add(sheet.texture);
          console.warn(`Enemy animation sheet '${sheet.texture}' (${clipUrl(sheet)}) did not load; those enemies keep their static art.`);
        }
      // A sheet of the previous mission still in flight at the restart may have landed since; release it again.
      if (types) for (const key of sheetPlan(types, (key) => scene.textures.exists(key)).release) scene.textures.remove(key);
    });
}
/** Texture lookups and Images of a scene, for `EnemySprites`. */
export const sceneSpriteHost = (scene: Phaser.Scene): SpriteHost => ({
  hasTexture: (key) => !failedArt.has(key) && scene.textures.exists(key),
  createImage: (key, frame) => scene.add.image(0, 0, key, frame),
  canTint: () => scene.sys.game.renderer.type === Phaser.WEBGL,
  rims: () => scene.sys.game.renderer.type === Phaser.WEBGL,
});
/**
 * WebGL texture filtering for the game config. The art is 256 px (the boss 512 px) and is shown at 20 to 60 world
 * pixels, so the GPU minifies it 4 to 12 times. Phaser already builds mipmaps for every power-of-two texture, but
 * samples them only with `LINEAR` unless a mipmap filter is set; plain bilinear then skips most texels and the art
 * shimmers while it moves and turns. Trilinear filtering reads the matching mip level. It changes only power-of-two
 * textures (the enemy art and Phaser's tiny built-in ones), so graphics, text and the canvas renderer are unaffected.
 */
export const ART_FILTERING = { mipmapFilter: "LINEAR_MIPMAP_LINEAR" } as const;
