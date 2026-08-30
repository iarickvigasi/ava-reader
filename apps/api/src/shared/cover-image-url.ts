// The Nest app mounts under a global `/api` prefix (see app.config.ts), so the
// public-facing URL must include it. Home and library payloads point browsers
// at the same cached URLs, all served by LibraryController's cover endpoint.
export function buildCoverImageUrl(bookId: string): string {
  return `/api/library/covers/${bookId}`;
}
