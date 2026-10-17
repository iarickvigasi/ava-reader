// Destructive cleanup has no production scheduler or enabled default.
// This implementation is exercised only against explicitly isolated test databases.
export function requirePdfRetentionTestAuthority() {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.AVA_PDF_TEST_HOOKS !== '1' ||
    process.env.AVA_PDF_TEST_RETENTION_ENABLED !== '1'
  )
    throw new Error('PDF_RETENTION_NOT_ENABLED');
}

export function requirePdfRetentionInterval(value: number) {
  requirePdfRetentionTestAuthority();
  if (!Number.isSafeInteger(value) || value < 1 || value > 90 * 86_400_000)
    throw new Error('PDF_RETENTION_INTERVAL_INVALID');
}
