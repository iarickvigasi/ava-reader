import type { CatalogDatabase } from '../../database/catalog-database';
import { readBootstrap } from './read-bootstrap';
import { bootstrapEdition } from './bootstrap-edition';
import type { Candidate, Manifest } from '../types';
export async function bootstrapCollection(
  db: CatalogDatabase,
  file: string,
): Promise<Manifest> {
  const books = await readBootstrap(file);
  const candidates: Candidate[] = [];
  for (const book of books) candidates.push(await bootstrapEdition(db, book));
  return { version: 1, candidates };
}
