import type { CatalogDatabase } from '../database/catalog-database';
import { CLASSICS } from './classics';
import { findClassicEditions } from './find-classic-editions';
import { editionCandidates } from './edition-candidates';
import type { Candidate } from './types';

export async function inventory(
  db: CatalogDatabase,
  limit: number,
  language?: string,
) {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const classic of CLASSICS) {
    if (language && classic.language !== language) continue;
    const editions = await findClassicEditions(db, classic);
    let selected = 0;
    for (const edition of editions) {
      for (const candidate of await editionCandidates(db, edition)) {
        const key = `${candidate.editionId}:${candidate.iaIdentifier}`;
        if (seen.has(key) || candidates.length >= limit || selected >= 5)
          continue;
        seen.add(key);
        candidates.push(candidate);
        selected++;
      }
      if (selected >= 5 || candidates.length >= limit) break;
    }
    console.error(
      JSON.stringify({
        classic: classic.title,
        author: classic.author,
        language: classic.language,
        candidates: selected,
      }),
    );
    if (candidates.length >= limit) break;
  }
  return { version: 1 as const, candidates };
}
