// Retain a bounded database code, never an exception message, URI or content.
export function backgroundFailureCode(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P[0-9]{4}$/.test(error.code)
    ? error.code
    : 'BACKGROUND_UNAVAILABLE';
}
