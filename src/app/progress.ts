// The only thing the browser keeps between visits: the id of the last started mission, for "Continue".
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
    // Not remembered; the menu then offers no "Continue".
  }
}
const TRAINING_KEY = "ion-bastion:training-done";
/** Won Training once; until then the home page emphasises it. */
export function trainingDone(): boolean {
  try {
    return localStorage.getItem(TRAINING_KEY) === "1";
  } catch {
    return false;
  }
}
export function markTrainingDone() {
  try {
    localStorage.setItem(TRAINING_KEY, "1");
  } catch {
    // Not remembered; the button simply stays emphasised.
  }
}
