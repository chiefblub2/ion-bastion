/**
 * Display depths of the battlefield layers, bottom to top. Phaser sorts by depth, and within one depth by creation
 * order, so images created mid-game (enemy sprites) still land between the enemy Graphics layers.
 */
export const DEPTH = {
  /** Ground, path, obstacles and the map's labels (`drawTerrain`). */
  terrain: 0,
  ambient: 1,
  /** Build-mode cell hints and the coverage overlay, above the ground and below the towers. */
  hints: 1.5,
  /** Baked still tower bodies (one Image per tower, `TowerBodies`), below the live turrets. */
  towerBodies: 1.8,
  /** `towerInk`: flat towers, the light of baked bodies, the live parts under tilted turrets. */
  towers: 2,
  /** Cached pictures of tilted turrets (`TurretCache`), one Image per tower, raised slightly per row (north first). */
  towerTurrets: 2.1,
  /** `towerTop`: live parts over tilted turrets, level bars and badges of cached ones; then the placing ghost. */
  towerTop: 2.2,
  /** `towerGlow`, the additive light of every tower. */
  towerGlow: 2.3,
  enemyUnderlay: 3,
  /** Procedural bodies (Graphics). */
  enemyBody: 4,
  /** Light rims behind the painted bodies (`EnemySprites`, WebGL only), below every painted body. */
  enemyRims: 4.5,
  /** Painted bodies (one Image per enemy), above the procedural ones and below every marker. */
  enemySprites: 5,
  /** Markers and HP bars. */
  enemyOverlay: 6,
  /** `ink` (selection ring, shots, effects, portal pulse), then its additive `glow`. */
  foreground: 7,
  /** Floating income and repair labels. */
  labels: 10,
} as const;
