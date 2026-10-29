import type { CatalogDatabase } from '../../database/catalog-database';
import type { Candidate } from '../types';
import { recordImportEvidence } from './record-import-evidence';
import { researchedWork } from './researched-work';
import { assertCandidateMapping } from '../assert-candidate-mapping';
jest.mock('../assert-candidate-mapping');
const candidate = {
  editionId: 'edition',
  workId: 'work',
  title: 'Emma',
  authors: ['Jane Austen'],
  language: 'en',
  provider: 'standard-ebooks',
  providerId: 'jane-austen/emma',
  filename: 'jane-austen_emma.epub',
  checksum: 'a'.repeat(64),
  inspectedAt: '2026-10-29T12:00:00Z',
} as Candidate;
it('upserts file-bound public evidence and original-work research without granting approval', async () => {
  const upsert = jest
    .fn<
      Promise<unknown>,
      [{ where: unknown; create: Record<string, unknown> }]
    >()
    .mockResolvedValue({});
  const tx = { editionImportEvidence: { upsert } };
  const db = {
    $transaction: (run: (tx: object) => unknown) => run(tx),
  } as unknown as CatalogDatabase;
  await recordImportEvidence(db, candidate);
  expect(assertCandidateMapping).toHaveBeenCalledWith(tx, candidate);
  const saved = upsert.mock.calls[0][0];
  expect(saved.where).toEqual({
    editionId_checksum: { editionId: 'edition', checksum: 'a'.repeat(64) },
  });
  expect(saved.create).toMatchObject({
    provider: 'standard-ebooks',
    sourceUrl: 'https://standardebooks.org/ebooks/jane-austen/emma',
    research: { authorDeathYear: 1817, worldwideCleared: false },
  });
  expect(upsert.mock.calls[0][0].create).not.toHaveProperty('review');
});
it('does not attach research based on title alone or a different language', () => {
  expect(
    researchedWork({ ...candidate, authors: ['Another author'] }),
  ).toBeNull();
  expect(researchedWork({ ...candidate, language: 'pl' })).toBeNull();
  expect(researchedWork(candidate)?.rules.map((rule) => rule.id)).toContain(
    'eu-term',
  );
});
