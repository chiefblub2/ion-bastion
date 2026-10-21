import { parseDraft } from "./codec";
import { blankDraft, type EditorDraft } from "./draft";

// Drafts the editor keeps in this browser: all saved ones and an autosave of the open one.
const DRAFTS_KEY = "ion-bastion:editor-drafts";
const CURRENT_KEY = "ion-bastion:editor-current";

/** The stored list as is; corrupt JSON is an empty list. */
function storedEntries(): unknown[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Saved drafts; entries that do not parse (corrupt, or from a newer draft version) are skipped, not lost. */
export function savedDrafts(): EditorDraft[] {
  return storedEntries()
    .map(parseDraft)
    .filter((d): d is EditorDraft => d !== undefined);
}

const entryId = (e: unknown) => (typeof e === "object" && e !== null ? (e as { id?: unknown }).id : undefined);

/**
 * The stored list with `d` added or replacing the entry with its id. Entries this version cannot read stay as they
 * are, so a draft saved by a newer build survives a save from an older one.
 */
export function withDraft(entries: readonly unknown[], d: EditorDraft): unknown[] {
  const at = entries.findIndex((e) => entryId(e) === d.id);
  return at >= 0 ? entries.map((e, i) => (i === at ? d : e)) : [...entries, d];
}

/** The stored list without the entry with this id; unreadable entries stay. */
export const withoutDraft = (entries: readonly unknown[], id: string) => entries.filter((e) => entryId(e) !== id);

/** Adds the draft, or replaces the saved one with the same id. */
export function saveDraft(d: EditorDraft) {
  write(DRAFTS_KEY, withDraft(storedEntries(), d));
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
  write(DRAFTS_KEY, withoutDraft(storedEntries(), id));
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
