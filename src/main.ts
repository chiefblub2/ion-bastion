import Phaser from "phaser";
import { Game } from "./core/game";
import { findMission, playableMissions } from "./content/missions";
import { DEFAULT_CONTENT } from "./content";
import { pageOf, towerOrder } from "./ui/tower-pages";
import { Battlefield, CELL, LocalDriver, type ViewState } from "./render/scene";
import { mountUI, Interface, renderMission } from "./ui/interface";
import { bindUpgradeTooltip } from "./ui/upgrade-tooltip";
import { installEnemyArtFallback } from "./ui/enemy-art-icon";
import { Audio } from "./app/audio";
import { bindUiSounds } from "./audio/ui-sounds";
import { bindSoundPanel } from "./ui/sound-panel";
import { bindFullscreen } from "./app/fullscreen";
import { createInput } from "./app/input";
import { registerTools } from "./app/webmcp";
import { screenFromUrl } from "./app/screens";
import { markTrainingDone } from "./app/progress";
import { Coach } from "./ui/coach-view";
import { TowerCard } from "./ui/tower-card-view";
import { waveHpScale } from "./systems/spawn";
import type { MissionDefinition } from "./core/types";
import { ART_FILTERING } from "./render/enemy-art-scene";
import "./style.css";
import "./menu.css";
// Dependencies flow top-down: state → view → UI → battlefield → input.
/** The mission from wave `wave` on; every remaining wave keeps the HP factor it has in the full mission. */
const fromWave = (m: MissionDefinition, wave: number): MissionDefinition => ({
  ...m,
  name: `${m.name} · from wave ${wave}`,
  waves: m.waves.slice(wave - 1).map((w, i) => ({ ...w, hpMultiplier: waveHpScale(m, wave + i) })),
});
// Deep link `?mission=<id>`: start in that mission; `&wave=<n>` (for checks) skips to wave n and `&credits=<n>`
// (for README screenshots) replaces the starting credits. Done before the UI and the scene are built, so they never
// see the default map.
const params = new URLSearchParams(location.search),
  linked = params.get("mission"),
  target = linked ? findMission(linked, DEFAULT_CONTENT) : undefined,
  skip = Number(params.get("wave")),
  credits = Number(params.get("credits"));
let linkedMission = target && skip > 1 && skip <= target.waves.length ? fromWave(target, skip) : target;
if (linkedMission && credits > 0) linkedMission = { ...linkedMission, startingCredits: credits };
const game = new Game(linkedMission !== target ? linkedMission : undefined);
if (target && game.mission.id !== target.id) game.command({ type: "mission", id: target.id });
mountUI(game);
installEnemyArtFallback();
renderMission(game);
bindUpgradeTooltip();
const first = towerOrder(game)[0];
const view: ViewState = { build: game.mission.manualWaves ? null : first, selected: null, enemy: null, hover: null, speed: 1, player: 0, coverage: false, page: pageOf(game.content.towers[first]) };
const ui = new Interface(game, view);
const audio = new Audio();
audio.armAutoStart();
const battlefield = new Battlefield(game, view, {
  // Pointer events only arrive after start-up, once `input` exists.
  chooseCell: (x, y, keepBuilding) => input.chooseCell(x, y, keepBuilding),
  chooseEnemy: (id) => input.chooseEnemy(id),
  cancel: () => input.cancel(),
  refresh: () => ui.refresh(),
  pulses: () => audio.pulses(),
  events: (e) => {
    audio.frame(e, game, input.match());
    if (e.some((event) => event.type === "income")) ui.flashCredits();
    if (game.mission.manualWaves && e.some((event) => event.type === "end" && event.result === "won")) markTrainingDone();
  },
});
const coach = new Coach(game, view, (cell) => battlefield.cellRect(cell));
const towerCard = new TowerCard(game, view, () => ui.session());
ui.onRefresh = () => {
  towerCard.refresh();
  coach.refresh();
};
const fullscreen = bindFullscreen(() => battlefield.fit());
const input = createInput({
  game,
  view,
  ui,
  audio,
  reloadBattlefield: () => battlefield.reload(),
  fitBattlefield: () => battlefield.fit(),
  setDriver: (driver) => {
    battlefield.driver = driver ?? new LocalDriver(game, view);
  },
  toggleFullscreen: fullscreen.toggle,
  isFullscreen: fullscreen.isActive,
  coach,
});
bindSoundPanel(audio, (text) => ui.notice(text, true));
bindUiSounds(audio);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "board",
  width: game.map.columns * CELL,
  height: game.map.rows * CELL,
  backgroundColor: "#0d1820",
  antialias: true,
  render: ART_FILTERING,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: battlefield,
  audio: { noAudio: true },
});
registerTools(game, input.execute);
ui.refresh();
// A deep link opens the game; everything else starts on the start screen (or the page its hash names).
input.screens.start(screenFromUrl(location.search, location.hash, playableMissions(game.content)));
