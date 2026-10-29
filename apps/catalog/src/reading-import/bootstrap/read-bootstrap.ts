import {
  providerReference,
  type ProviderInput,
} from '../providers/provider-reference';
import { dirname, resolve } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { CLASSICS } from '../classics';
import { MAX_CANDIDATES, MAX_MANIFEST_BYTES } from '../types';
export type BootstrapBook = ProviderInput & {
  title: string;
  author: string;
  language: string;
  filename?: string;
  localFile?: string;
};
export async function readBootstrap(path: string) {
  if ((await stat(path)).size > MAX_MANIFEST_BYTES)
    throw new Error('Collection too large');
  const value = JSON.parse(await readFile(path, 'utf8')) as {
    version: number;
    books: BootstrapBook[];
  };
  if (
    value.version !== 1 ||
    !Array.isArray(value.books) ||
    !value.books.length ||
    value.books.length > MAX_CANDIDATES
  )
    throw new Error('Collection needs 1..100 books');
  const seen = new Set<string>();
  return value.books.map((book) => {
    const seed = CLASSICS.find(
      (row) =>
        row.language === book.language &&
        [row.title, ...row.titleAliases].includes(book.title) &&
        [row.author, ...row.authorAliases].includes(book.author),
    );
    if (!seed)
      throw new Error(
        'Choose a shortlist work and an exact provider identifier',
      );
    const source = providerReference(book);
    const key = `${source.provider}:${source.id}:${book.language}`;
    if (seen.has(key)) throw new Error('Duplicate provider edition');
    seen.add(key);
    return {
      ...book,
      title: seed.title,
      author: seed.author,
      localFile: book.localFile
        ? resolve(dirname(path), book.localFile)
        : undefined,
    };
  });
}
