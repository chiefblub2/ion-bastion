/** A room code as typed: whitespace dropped, upper case. The relay's codes are four letters. */
export const normalizeRoomCode = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();
export const isRoomCode = (code: string) => /^[A-Z]{4}$/.test(code);
export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}
/** Copies `text`; true only when the browser confirmed it. Without the Clipboard API, or when it rejects, false. */
export async function copyText(text: string, clipboard: ClipboardLike | undefined = globalThis.navigator?.clipboard): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
