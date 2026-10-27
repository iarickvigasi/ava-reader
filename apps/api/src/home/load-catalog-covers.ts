type PublicCover = { entryId: string; coverImageUrl: string | null };

// Public metadata only: no Book covers or private file fallback on failure.
export async function loadCatalogCovers(entryIds: string[]) {
  if (!entryIds.length) return new Map<string, string | null>();
  const base = process.env.CATALOG_API_BASE_URL ?? 'http://localhost:4001';
  const query = new URLSearchParams({ entryIds: entryIds.join(',') });
  try {
    const response = await fetch(`${base}/api/reading-assets/covers?${query}`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return new Map<string, string | null>();
    const { items } = (await response.json()) as { items: PublicCover[] };
    return new Map(
      items.map(({ entryId, coverImageUrl }) => [entryId, coverImageUrl]),
    );
  } catch {
    return new Map<string, string | null>();
  }
}
