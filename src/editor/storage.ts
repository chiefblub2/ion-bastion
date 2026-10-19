import { parseDraft } from "./codec";
import type { EditorDraft } from "./draft";

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
