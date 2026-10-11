/**
 * Display depths of the battlefield layers, bottom to top. Phaser sorts by depth, and within one depth by creation
 * order, so images created mid-game (enemy sprites) still land between the enemy Graphics layers.
 */
export const DEPTH = {
  /** Ground, path, obstacles and the map's labels (`drawTerrain`). */
  terrain: 0,
  ambient: 1,
  /** `towerInk`, then its additive `towerGlow`. */
  towers: 2,
  enemyUnderlay: 3,
  /** Procedural bodies (Graphics). */
  enemyBody: 4,
  /** Painted bodies (one Image per enemy), above the procedural ones and below every marker. */
  enemySprites: 5,
  /** Markers and HP bars. */
  enemyOverlay: 6,
  /** `ink` (selection ring, shots, effects, portal pulse), then its additive `glow`. */
  foreground: 7,
  /** Floating income and repair labels. */
  labels: 10,
} as const;
