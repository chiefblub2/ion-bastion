---
name: animation-pack
description: Integrate supplied enemy animation spritesheets (idle, move, hurt, death in one 8×4 grid per enemy) into ION BASTION, verifying each sheet shows the enemy its file name claims. Use when the user provides or commits new enemy animation sheets, an animation pack, or asks to animate more enemy types ("animation pack", "spritesheet", "animate enemies", "new animations"). Not for generating artwork and not for static enemy art (that is `scripts/audit-enemy-art.ts`).
---

# Animation pack

Playbook for turning supplied enemy animation sheets into playable animations. No new code is needed for a normal pack: the manifest is the only registry, and loading, the Codex preview and the review page pick up every registered type by themselves.

Read the "Enemy animations" bullet in CLAUDE.md first. Never generate or repaint art; work only with the committed files. Never trust a file name: the first extra pack had ten sheets under each other's names (ant held the wolf, cog the pebble, …).

## 0. Inventory (you, read only)

- Find the new sheets. Raw sheets belong in `assets-src/enemy-animations/<id>.png`; anything in `public/assets/enemy-animations/` that is not 2048×1024 is unnormalized and must move to `assets-src/` (the audit flags strays there).
- `file <sheet>` for the size. The supplied format is 8 × 4 cells of `frameWidth` × `frameHeight` (the manifest's top-level values, 222 px so far, 1776×888). A pack with another cell size or layout needs its own manifest values, so stop and ask before mixing it in.
- Every `<id>` must be an enemy in `content/` with static art in `public/assets/enemies/<id>.png`.
- Note which types already animate (`manifest.json` `enemies`); never overwrite a reviewed sheet without a reason.

## 1. Verify identity before renaming anything

1. Contact sheet per sheet: its static PNG next to idle, move, hurt and death frames. Compare silhouette, palette, mechanical parts and facing (all art faces right). A small script on `scripts/png.ts` (`decodePng`, `encodePng`) does it; keep it in the scratchpad.
2. Add the entries to the manifest (step 2) and run the audit (step 4). Its identity table ranks every source sheet's idle frames against all static art (`identify`, `scripts/png.ts`):
   - `ERROR <id>: … looks like <other>`: the file holds another enemy. Confirm by eye.
   - `WARN … identity is close to …`: confirm by eye; boss/tank is a known close pair.
3. Mislabelled files: write the full mapping (file → real id) first and check it is consistent (no two files claiming one id, no file overwriting a valid sheet). Then `git mv` each file to its real id. When names swap inside one directory, stage through temporary names (`<id>.tmp.png`) so nothing is overwritten.
4. A sheet whose identity stays unclear, or whose real enemy already has a better sheet, gets `"disabled": "<reason>"` in the manifest. It then shows static art. Never assign a doubtful design.

## 2. Manifest entry

In `assets-src/enemy-animations/manifest.json` (`AnimationManifest` in `src/render/enemy-animations.ts` documents it):

```json
"<id>": { "sheet": "assets-src/enemy-animations/<id>.png" }
```

Optional per entry:
- `"animations": { "hurt": { "fps": 18 }, "death": null }`: override fields of a state, or drop a state (it falls back: move ↔ idle, no hurt, no death). Idle cannot be dropped. Only use overrides the sheet really has; never pad missing frames.
- `"disabled": "<reason>"`: keep the source, register nothing.

## 3. Normalize

```sh
npx vite-node scripts/normalize-enemy-animations.ts
```

- It re-cuts every enabled entry into `public/assets/enemy-animations/<id>.png` (256 px cells, 2048×1024) and is repeatable. Before running, keep `md5 -q public/assets/enemy-animations/*.png`; afterwards every sheet that was already there must be byte-identical. If one changed, find out why before accepting it.
- Read its notes per clip: `cut through N px` (frames touching), `N visible px fall outside the 256 px cell` (clipped plumes or debris), `unwrapped`, `erased faint grid lines`, `loop kept as drawn`. Large losses on idle or move are a defect; small ones on death debris usually are not.
- Fix problems with the smallest generic change to the script (it already handles frame overlap, vertical wrap, grid lines, sliding loops). No per-enemy rules unless nothing generic works.

## 4. Audit and bounds

```sh
npx vite-node scripts/audit-enemy-animations.ts
npx vite-node scripts/audit-enemy-animations.ts -- --write   # regenerates src/render/enemy-animation-bounds.ts
```

- Exit code 1 on errors: wrong grid, blank frame, cut body, loop pivot jump, drawn unused cell, identity mismatch, stray file in `public/`.
- Warnings need a look by eye: pivot drift, size jumps, art on the cell border, an empty last death frame (a fade-out is fine).
- Check the new `ANIMATION_BOUNDS` rows: the size and centre should match the body as you see it. An outsized height or a centre far from the body means stray specks (grid-line remnants) inflate the union; fix the source cleanup, not the numbers. Never edit the generated file by hand.
- Note the "Per mission" line: the largest mission's sheet count × 8 MiB is its texture cost.

## 5. Visual review (dev server on :4173)

```sh
npx vite-node scripts/enemy-anim-review.ts -- --ids <id>,<id> --frame 3 --out visual-check/anim-review-<pack>
npx vite-node scripts/visual-check.ts -- <missionId>... --enemies <id>,<id> --out visual-check/ingame-<pack>
```

- Look at the screenshots, don't just count them: right enemy, same size and centre as the static art, correct facing at the four headings, no grid lines or clipped body.
- Review every frame of every clip on the full normalized sheet as well (contact sheet): loop seams, hurt recoil, death that breaks apart and ends.
- Find the missions for `visual-check` from the first wave each type appears in (`DEFAULT_CONTENT.missions`); always skip to the wave, never play through.
- A sheet that fails review: `"disabled": "<reason>"`, re-run steps 3–4, and report it.

## 6. Tests and finish

```sh
npm test
npm run build
```

The suite covers new types without edits: every manifest-enabled type is registered and has static art, public files match the registry, frame layout, bounds current, loop drift, identity against all static art, no stray specks, and a full idle → move → hurt → death run per type in `enemy-sprites.test.ts`. Only touch a test if a reviewed sheet legitimately breaks a threshold, and say why in its comment.

Update the "16 so far" count in CLAUDE.md's "Enemy animations" bullet.

## Report

- Inventory: types, static art, source sheets, registered, static-only.
- Per new type: idle, move, hurt, death, QA result.
- Every rename (file → real id) and how identity was confirmed.
- Disabled sheets with reasons, remaining defects, changed existing sheets (should be none).
- Commands run and their results; which screenshots were actually looked at.
