type PublicCover = {
  entryId: string;
  coverImageUrl: string | null;
  editionId?: string;
};

// Public metadata only: no Book covers or private file fallback on failure.
export async function loadCatalogCovers(entryIds: string[]) {
  if (!entryIds.length) return new Map<string, PublicCover>();
  const base = process.env.CATALOG_API_BASE_URL ?? 'http://localhost:4001';
  const query = new URLSearchParams({ entryIds: entryIds.join(',') });
  try {
    const response = await fetch(`${base}/api/reading-assets/covers?${query}`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return new Map<string, PublicCover>();
    const { items } = (await response.json()) as { items: PublicCover[] };
    return new Map(items.map((item) => [item.entryId, item]));
  } catch {
    return new Map<string, PublicCover>();
  }
}
