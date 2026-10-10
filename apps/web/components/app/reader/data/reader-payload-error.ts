export type ReaderPayloadErrorCode = "PDF_READER_UPGRADE_REQUIRED";

export class ReaderPayloadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: ReaderPayloadErrorCode,
  ) {
    super("The reader payload could not be loaded.");
    this.name = "ReaderPayloadError";
  }
}
