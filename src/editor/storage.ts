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

/** True when the draft differs from its saved copy (same id), or has none and is not an untouched blank of its size. */
export function hasUnsavedWork(d: EditorDraft, saved: readonly EditorDraft[]): boolean {
  const json = JSON.stringify(d),
    copy = saved.find((x) => x.id === d.id);
  return copy ? JSON.stringify(copy) !== json : JSON.stringify(blankDraft(d.sketch[0].length, d.sketch.length)) !== json;
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
