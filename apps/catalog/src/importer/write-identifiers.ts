import { isbnValues } from './isbn-values';
import type { Raw, Tx } from './types';

export async function writeIdentifiers(
  tx: Tx,
  editionId: string,
  raw: Raw,
  overrides: string[] = [],
  conflicts: string[] = [],
) {
  if (raw.isbn_10 === undefined && raw.isbn_13 === undefined) return;
  const values = isbnValues(raw);
  for (const normalizedValue of values) {
    if (overrides.includes(`identifiers:ISBN_13:${normalizedValue}`)) {
      conflicts.push('identifiers');
      continue;
    }
    const identifier = await tx.identifier.upsert({
      where: { scheme_normalizedValue: { scheme: 'ISBN_13', normalizedValue } },
      create: { scheme: 'ISBN_13', normalizedValue },
      update: {},
    });
    await tx.editionIdentifier.upsert({
      where: {
        editionId_identifierId: {
          editionId,
          identifierId: identifier.id,
        },
      },
      create: { editionId, identifierId: identifier.id },
      update: {},
    });
  }
}
