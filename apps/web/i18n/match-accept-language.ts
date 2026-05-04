import { type Locale, isLocale, locales } from "./locales";

// Picks the best supported locale for an Accept-Language header value.
// Returns null when nothing matches so the caller can fall back to its default.
//
// RFC 4647 lookup: walk the header entries in q-order, and for each entry try
// an exact tag match first, then a primary-subtag fallback. The first hit wins.
// This means a high-q "pt" → "pt-BR" (only Portuguese variant we ship) beats a
// lower-q exact match like "fr".
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  for (const tag of parseAcceptLanguage(header)) {
    const exact = locales.find((l) => l.toLowerCase() === tag.toLowerCase());
    if (exact && isLocale(exact)) return exact;

    const primary = tag.split("-")[0]?.toLowerCase();
    if (!primary) continue;
    const byPrimary = locales.find(
      (l) => l.split("-")[0].toLowerCase() === primary,
    );
    if (byPrimary && isLocale(byPrimary)) return byPrimary;
  }

  return null;
}

// Returns tags ordered by descending q-value, dropping wildcards and q=0.
function parseAcceptLanguage(header: string): string[] {
  const parsed = header
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(";");
      const tag = rawTag?.trim();
      if (!tag || tag === "*") return null;
      let q = 1;
      for (const p of params) {
        const [k, v] = p.trim().split("=");
        if (k === "q" && v !== undefined) {
          const parsedQ = Number.parseFloat(v);
          if (Number.isFinite(parsedQ)) q = parsedQ;
        }
      }
      if (q <= 0) return null;
      return { tag, q };
    })
    .filter((entry): entry is { tag: string; q: number } => entry !== null);

  parsed.sort((a, b) => b.q - a.q);
  return parsed.map((e) => e.tag);
}
