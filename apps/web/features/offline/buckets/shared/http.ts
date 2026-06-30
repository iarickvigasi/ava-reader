// Shared HTTP helpers for the offline bucket sync layers (highlights,
// ai-comments). The transient-vs-permanent failure policy and the Nest
// error-body parser are identical across buckets, so they live here once and
// each sync layer composes them into its own (bucket-specific) SendResult.

// Transient = retry forever. 401 (auth may refresh), 408 timeout, 425 too
// early, 429 rate limit, 5xx server problems.
export function isTransientStatus(status: number): boolean {
  if (status === 401 || status === 408 || status === 425 || status === 429) {
    return true;
  }
  return status >= 500 && status < 600;
}

// Permanent = drop the mutation and tell the user. 400 validation, 403
// forbidden, 404 gone, 409 conflict, 410 gone, 413 payload too large, 415
// unsupported media type, 422 unprocessable.
export function isPermanentStatus(status: number): boolean {
  return (
    status === 400 ||
    status === 403 ||
    status === 404 ||
    status === 409 ||
    status === 410 ||
    status === 413 ||
    status === 415 ||
    status === 422
  );
}

// Outcome of classifying a non-OK response: retry transient/unknown statuses
// forever, drop permanent ones with a user-readable reason. Both buckets'
// richer SendResult unions are supersets of this, so it composes directly.
export type FailureResult = { kind: "retry" } | { kind: "drop"; reason: string };

// Decide whether a 4xx/5xx response is transient (retry forever) or permanent
// (drop and tell the user). Unknown statuses are treated as retryable:
// silently losing data is the worst outcome, and the queue is idempotent so
// retrying a "should have been dropped" mutation just hits the same error.
export async function classifyFailure(
  response: Response,
): Promise<FailureResult> {
  if (isTransientStatus(response.status)) {
    return { kind: "retry" };
  }
  if (isPermanentStatus(response.status)) {
    const reason = await extractReason(response);
    return { kind: "drop", reason };
  }
  return { kind: "retry" };
}

// Pulls a user-readable reason out of an error response. Nest's HttpException
// emits { statusCode, message, error } where `message` is a string or a
// string[]; fall back to the raw body, then to `HTTP <status>`.
export async function extractReason(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return `HTTP ${response.status}`;
    }
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) {
        return parsed.message.join(", ");
      }
      if (typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      // Body wasn't JSON — fall through and use the raw text.
    }
    return text;
  } catch {
    return `HTTP ${response.status}`;
  }
}
