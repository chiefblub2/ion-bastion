import { parseDraft } from "./codec";
import { blankDraft, type EditorDraft } from "./draft";

// Drafts the editor keeps in this browser: all saved ones and an autosave of the open one.
const DRAFTS_KEY = "ion-bastion:editor-drafts";
const CURRENT_KEY = "ion-bastion:editor-current";

/** Saved drafts; corrupt JSON is an empty list and invalid entries are dropped. */
export function savedDrafts(): EditorDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data.map(parseDraft).filter((d): d is EditorDraft => d !== undefined);
  } catch {
    return [];
  }
}

/** Adds the draft, or replaces the saved one with the same id. */
export function saveDraft(d: EditorDraft) {
  const rest = savedDrafts();
  const at = rest.findIndex((x) => x.id === d.id);
  if (at >= 0) rest[at] = d;
  else rest.push(d);
  write(DRAFTS_KEY, rest);
}

/**
 * The draft to auto-save before `displaced` is replaced by `incoming`, or undefined when there is nothing to keep
 * (equal to its saved copy, or an untouched blank). Never overwrites a different saved entry: on an id clash
 * (a differing saved copy, or the incoming draft sharing the id) it takes the first free `<id>-2`, `-3`, ….
 */
export function keepTarget(displaced: EditorDraft, incoming: EditorDraft, saved: readonly EditorDraft[]): EditorDraft | undefined {
  const json = JSON.stringify(displaced),
    copy = saved.find((x) => x.id === displaced.id);
  if (copy ? JSON.stringify(copy) === json : JSON.stringify(blankDraft(displaced.sketch[0].length, displaced.sketch.length)) === json) return undefined;
  if (!copy && incoming.id !== displaced.id) return displaced;
  const taken = new Set([incoming.id, ...saved.map((x) => x.id)]);
  let n = 2;
  while (taken.has(`${displaced.id}-${n}`)) n++;
  return { ...displaced, id: `${displaced.id}-${n}`, name: `${displaced.name} (${n})` };
}

export function deleteDraft(id: string) {
  write(DRAFTS_KEY, savedDrafts().filter((d) => d.id !== id));
}

export function currentDraft(): EditorDraft | undefined {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? parseDraft(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

export function rememberDraft(d: EditorDraft) {
  write(CURRENT_KEY, d);
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept; the draft lives on in the open editor.
  }
}
