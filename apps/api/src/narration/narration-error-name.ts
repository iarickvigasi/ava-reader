const SAFE_NAMES = new Set([
  'TimeoutError',
  'AbortError',
  'TypeError',
  'Error',
  'ZodError',
  'ServiceUnavailableException',
  'UnprocessableEntityException',
]);

// DOMException/fetch errors can cross realms and fail instanceof Error.
// Only known type names may enter diagnostics; never echo arbitrary thrown data.
export function narrationErrorName(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    typeof error.name === 'string' &&
    SAFE_NAMES.has(error.name)
  )
    return error.name;
  return 'UnknownError';
}
