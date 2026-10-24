import type { Game } from "../core/game";
import { stateHash } from "../core/hash";
import type { Command } from "../core/types";
import { mark, newJournal, record, type Journal } from "../run/journal";
import { isRunMission } from "../run/run-id";
import { loadJournal, saveJournal } from "../run/storage";
/**
 * Keeps the journal of the run mission being played (`run/journal.ts`): every applied command with its tick, saved
 * with the state hash after each command, every few seconds of play, at each wave end and when the page hides. A
 * reload then resumes the mission by replaying it; there is no way to restart it.
 */
let journal: Journal | undefined;
/** Ticks between periodic saves (10 s of simulation). */
const EVERY = 300;
let saved = 0;
/** A freshly deployed mission starts an empty journal; a resumed one continues the stored one. */
export function beginJournal(game: Game, resumed?: Journal) {
  journal = resumed ?? newJournal(game.mission.id);
  persist(game);
}
const active = (game: Game) => !!journal && isRunMission(game.mission) && journal.missionId === game.mission.id;
export function journalCommand(game: Game, c: Command) {
  if (!active(game)) return;
  journal = record(journal!, game.ticks, c);
  persist(game);
}
export function persist(game: Game) {
  if (!active(game)) return;
  journal = mark(journal!, game.ticks, stateHash(game.state), game.state.wave);
  saved = game.ticks;
  saveJournal(journal);
}
/** Called once per frame: saves every `EVERY` ticks and at a wave's end. */
export function journalFrame(game: Game, waveEnded: boolean) {
  if (active(game) && (waveEnded || game.ticks - saved >= EVERY)) persist(game);
}
/** The mission ended: the run settles it, the journal is gone. */
export function endJournal() {
  journal = undefined;
  saveJournal(undefined);
}
export const storedJournal = () => loadJournal();
