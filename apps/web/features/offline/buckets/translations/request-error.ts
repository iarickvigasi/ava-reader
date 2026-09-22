import { isTransientStatus } from "../shared/http";

export class TranslationRequestError extends Error {
  readonly retryable: boolean;

  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TranslationRequestError";
    this.retryable = isTransientStatus(status);
  }
}

export function isRetryableTranslationError(error: unknown): boolean {
  return error instanceof TranslationRequestError
    ? error.retryable
    : error instanceof TypeError ||
        (error instanceof Error && error.name === "TimeoutError");
}
