import { missionById } from "../content/missions";
import type { MissionDefinition } from "../core/types";
/** The start screen and its pages, or the game. Both views live in one document; only the URL and `data-view` change. */
export type MenuPage = "home" | "missions" | "coop" | "codex" | "help";
export type Screen = { view: "menu"; page: MenuPage } | { view: "game" };
export const HOME: Screen = { view: "menu", page: "home" };
export const GAME: Screen = { view: "game" };
const SLUGS: Record<Exclude<MenuPage, "home">, string> = {
  missions: "missionen",
  coop: "mehrspieler",
  codex: "gegnerakte",
  help: "spielhilfe",
};
const PAGES = Object.keys(SLUGS) as Exclude<MenuPage, "home">[];
/** A valid `?mission=` opens the game (the deep link); otherwise the hash names a menu page, unknown ones the home page. */
export function screenFromUrl(search: string, hash: string, missions: readonly MissionDefinition[]): Screen {
  const id = new URLSearchParams(search).get("mission");
  if (id && missionById(id, missions)) return GAME;
  const slug = decodeURIComponent(hash.replace(/^#/, ""));
  return { view: "menu", page: PAGES.find((page) => SLUGS[page] === slug) ?? "home" };
}
/** `/` for home, `/#<page>` for the other menu pages, `/?mission=<id>` for the game; `path` keeps a deployment's base path. */
export function urlOf(screen: Screen, missionId: string, path = "/") {
  if (screen.view === "game") return `${path}?mission=${encodeURIComponent(missionId)}`;
  return screen.page === "home" ? path : `${path}#${SLUGS[screen.page]}`;
}
export const sameScreen = (a: Screen, b: Screen) => a.view === b.view && (a.view === "game" || a.page === (b as typeof a).page);
type Entry = Screen & { depth: number };
/**
 * Navigation through the History API: every screen is a history entry, so the browser's Back button works.
 * `depth` counts the in-app entries before the current one; "Zurück" only steps back through those.
 */
export function createScreens(missions: readonly MissionDefinition[], missionId: () => string, enter: (to: Screen, from: Screen | null) => void) {
  let current: Screen | null = null,
    depth = 0;
  const url = (screen: Screen) => urlOf(screen, missionId(), location.pathname);
  function apply(screen: Screen) {
    const from = current;
    current = screen;
    document.documentElement.dataset.view = screen.view;
    enter(screen, from);
  }
  addEventListener("popstate", (e) => {
    const entry = e.state as Entry | null;
    depth = entry?.depth ?? 0;
    const screen: Screen = entry ? (entry.view === "game" ? GAME : { view: "menu", page: entry.page }) : screenFromUrl(location.search, location.hash, missions);
    // An older game entry may name another mission than the loaded one.
    if (screen.view === "game") history.replaceState({ ...screen, depth } satisfies Entry, "", url(screen));
    apply(screen);
  });
  return {
    current: () => current ?? HOME,
    /** The first screen; keeps the URL as loaded, so deep-link extras (`&wave`, `&credits`) stay visible. */
    start(screen: Screen) {
      history.replaceState({ ...screen, depth } satisfies Entry, "", location.href);
      apply(screen);
    },
    show(screen: Screen, { replace = false } = {}) {
      if (current && sameScreen(current, screen)) return;
      if (!replace) depth++;
      history[replace ? "replaceState" : "pushState"]({ ...screen, depth } satisfies Entry, "", url(screen));
      apply(screen);
    },
    /** One step back inside the app; without an earlier in-app entry back to the home page. */
    back() {
      if (depth > 0) history.back();
      else this.show(HOME, { replace: true });
    },
    /** Rewrites the game URL after the mission changed, e.g. "Nächste Mission". */
    syncUrl() {
      if (current?.view === "game") history.replaceState({ ...GAME, depth } satisfies Entry, "", url(GAME));
    },
  };
}
export type Screens = ReturnType<typeof createScreens>;
