export type ProviderFailureDiagnostic = {
  httpStatus: number;
  complete: boolean;
  classification:
    | 'RATE_LIMIT'
    | 'CREDITS'
    | 'AUTHENTICATION'
    | 'REQUEST'
    | 'HTTP_ERROR';
  limitSource?: string;
  retryAfterSeconds?: number;
};
const sources = new Set([
  'openrouter_in_flight_budget',
  'openrouter_key_limit',
  'openrouter_credits',
  'upstream_provider_shared_pool',
]);
// Only allowlisted machine fields enter operator events. Never copy provider messages.
// Classification is diagnostic: it does not prove zero charge or authorize a retry.
export function httpFailureDiagnostic(
  status: number,
  complete: boolean,
  body: string,
  retryAfter: string | null,
  date: string | null,
): ProviderFailureDiagnostic {
  const classification =
    status === 429
      ? 'RATE_LIMIT'
      : status === 402
        ? 'CREDITS'
        : status === 401
          ? 'AUTHENTICATION'
          : [400, 413, 422].includes(status)
            ? 'REQUEST'
            : 'HTTP_ERROR';
  const result: ProviderFailureDiagnostic = {
    httpStatus: status,
    complete,
    classification,
  };
  if (complete) {
    try {
      const value = JSON.parse(body) as {
        error?: { metadata?: { limit_source?: unknown } };
      };
      const source = value?.error?.metadata?.limit_source;
      if (typeof source === 'string' && sources.has(source))
        result.limitSource = source;
    } catch {
      /* Non-JSON and malformed errors still retain their known HTTP status. */
    }
  }
  if (retryAfter && retryAfter.length <= 80) {
    const seconds = /^\d+$/.test(retryAfter)
      ? Number(retryAfter)
      : date
        ? (Date.parse(retryAfter) - Date.parse(date)) / 1000
        : NaN;
    if (Number.isInteger(seconds) && seconds >= 0 && seconds <= 86400)
      result.retryAfterSeconds = seconds;
  }
  return result;
}
