// The only thing the browser keeps between visits: the id of the last started mission, for "Weiterspielen".
const KEY = "ion-bastion:last-mission";
/** Storage can be missing or throw (private mode, blocked site data); then there is simply no last mission. */
export function lastMission(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
export function rememberMission(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not remembered; the menu then offers no "Weiterspielen".
  }
}
