import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBootstrap } from './read-bootstrap';
import { candidateSource } from '../candidate-source';
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ava-bootstrap-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const book = {
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  language: 'en',
  iaIdentifier: 'verified-item',
  localFile: 'book.epub',
};
async function input(books: unknown[]) {
  const path = join(directory, 'books.json');
  await writeFile(path, JSON.stringify({ version: 1, books }));
  return path;
}
it('validates a bounded collection without needing any Open Library IDs and resolves local paths', async () => {
  expect(await readBootstrap(await input([book]))).toEqual([
    { ...book, localFile: join(directory, 'book.epub') },
  ]);
});
it('refuses unlisted works, invalid sources, and duplicate editions before writing descriptions', async () => {
  await expect(
    readBootstrap(await input([{ ...book, title: 'Unreviewed' }])),
  ).rejects.toThrow('shortlist');
  await expect(
    readBootstrap(await input([{ ...book, iaIdentifier: '../bad' }])),
  ).rejects.toThrow('identifier');
  await expect(readBootstrap(await input([book, book]))).rejects.toThrow(
    'Duplicate',
  );
});
it('keeps source identity strict for both supported adapters', () => {
  expect(candidateSource({ externalId: '/books/OL1M' })).toBe('open-library');
  expect(
    candidateSource({
      sourceKey: 'curated-classics',
      externalId: 'curated:verified-item:en',
    }),
  ).toBe('curated-classics');
  expect(() =>
    candidateSource({
      sourceKey: 'curated-classics',
      externalId: '/books/OL1M',
    }),
  ).toThrow('Unsupported');
});
