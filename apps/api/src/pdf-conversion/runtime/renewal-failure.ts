// Only known infrastructure failures can retry inside the already-confirmed lease.
const TRANSIENT = new Set([
  'P1001',
  'P1002',
  'P1017',
  'P2024',
  'P2028',
  'ECONNRESET',
  'ETIMEDOUT',
]);
export function renewalFailure(error: unknown) {
  const value =
    error instanceof Error && 'code' in error ? error.code : undefined;
  const code =
    typeof value === 'string' &&
    (TRANSIENT.has(value) || value === 'PDF_JOB_AUTHORITY_INVALID')
      ? value
      : 'RENEWAL_FAILED';
  return { code, retry: TRANSIENT.has(code) };
}
