import type { ContentPack, MissionDefinition } from "../core/types";

/** What the mission editor may do in the app; implemented by `app/input.ts`. */
export interface EditorHost {
  content: ContentPack;
  /** Loads the mission as a playtest and switches to the game on success. */
  playtest(mission: MissionDefinition): void;
  /** False while a multiplayer room is active. */
  canPlaytest(): boolean;
  notice(text: string): void;
  /** `location.origin + location.pathname`, for share links. */
  base: string;
}

/** Renders the editor into `#editor-root`. Stub until the editor view lands. */
export function openEditor(host: EditorHost): void {
  const root = document.getElementById("editor-root");
  if (!root) return;
  root.innerHTML = "<h1>Mission editor</h1>";
  void host;
}
