import { isbnValues } from './isbn-values';
import type { Raw, Tx } from './types';

export async function writeIdentifiers(tx: Tx, editionId: string, raw: Raw) {
  if (raw.isbn_10 === undefined && raw.isbn_13 === undefined) return;
  const values = isbnValues(raw);
  const identifiers = [];
  for (const normalizedValue of values) {
    const identifier = await tx.identifier.upsert({
      where: { scheme_normalizedValue: { scheme: 'ISBN_13', normalizedValue } },
      create: { scheme: 'ISBN_13', normalizedValue },
      update: {},
    });
    identifiers.push(identifier.id);
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
  await tx.editionIdentifier.deleteMany({
    where: { editionId, identifierId: { notIn: identifiers } },
  });
}
