/**
 * Phaser 4 types `Graphics.fillPoints`/`strokePoints` as `Vector2[]`, but the methods only read `x` and `y`
 * (as in Phaser 3, whose types took plain points). The draw code passes plain `{ x, y }` literals, so allow those.
 */
declare namespace Phaser.GameObjects {
  interface Graphics {
    fillPoints(points: readonly Phaser.Types.Math.Vector2Like[], closeShape?: boolean, closePath?: boolean, endIndex?: number): this;
    strokePoints(points: readonly Phaser.Types.Math.Vector2Like[], closeShape?: boolean, closePath?: boolean, endIndex?: number): this;
  }
}
