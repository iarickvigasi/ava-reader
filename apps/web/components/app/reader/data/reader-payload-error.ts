export class ReaderPayloadError extends Error {
  constructor(public readonly status: number) {
    super("The reader payload could not be loaded.");
    this.name = "ReaderPayloadError";
  }
}
