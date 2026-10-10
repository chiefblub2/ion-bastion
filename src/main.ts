import Phaser from "phaser";
import { Game } from "./core/game";
import { pageOf, towerOrder } from "./ui/tower-pages";
import { Battlefield, CELL, LocalDriver, type ViewState } from "./render/scene";
import { mountUI, Interface, renderMission } from "./ui/interface";
import { bindUpgradeTooltip } from "./ui/upgrade-tooltip";
import { Audio } from "./app/audio";
import { bindFullscreen } from "./app/fullscreen";
import { createInput } from "./app/input";
import { registerTools } from "./app/webmcp";
import "./style.css";
// Dependencies flow top-down: state → view → UI → battlefield → input.
const game = new Game();
mountUI(game);
renderMission(game);
bindUpgradeTooltip();
const first = towerOrder(game)[0];
const view: ViewState = { build: first, selected: null, enemy: null, hover: null, speed: 1, player: 0, page: pageOf(game.content.towers[first]) };
const ui = new Interface(game, view);
const audio = new Audio();
const battlefield = new Battlefield(game, view, {
  // Pointer events only arrive after start-up, once `input` exists.
  chooseCell: (x, y, keepBuilding) => input.chooseCell(x, y, keepBuilding),
  chooseEnemy: (id) => input.chooseEnemy(id),
  cancel: () => input.cancel(),
  refresh: () => ui.refresh(),
  events: (e) => {
    audio.play(e);
    if (e.some((event) => event.type === "income")) ui.flashCredits();
  },
});
const fullscreen = bindFullscreen(() => battlefield.fit());
const input = createInput({
  game,
  view,
  ui,
  audio,
  reloadBattlefield: () => battlefield.reload(),
  setDriver: (driver) => {
    battlefield.driver = driver ?? new LocalDriver(game, view);
  },
  toggleFullscreen: fullscreen.toggle,
  isFullscreen: fullscreen.isActive,
});
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "board",
  width: game.map.columns * CELL,
  height: game.map.rows * CELL,
  backgroundColor: "#0d1820",
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: battlefield,
  audio: { noAudio: true },
});
registerTools(game, input.execute);
ui.refresh();
