/** Malformed content, with the path to the offending entry in the message. */
export class ContentError extends Error {
  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`${path}: ${reason}`);
    this.name = "ContentError";
  }
}
