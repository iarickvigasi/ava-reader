import { applyPublication } from './apply-publication';
import { assertCandidateMapping } from '../../reading-import/assert-candidate-mapping';
import type { CatalogDatabase } from '../../database/catalog-database';
import type { Candidate } from '../../reading-import/types';

jest.mock('../../reading-import/assert-candidate-mapping');
const candidate = {
  editionId: '12345678-1234-4234-9234-123456789012',
  checksum: 'a'.repeat(64),
  iaIdentifier: 'classic',
  filename: 'classic.epub',
  review: {
    sha256: 'a'.repeat(64),
    reviewer: 'admin',
    rightsStatement: 'Reviewed edition',
    rightsUrl: 'https://archive.org/details/classic',
    rightsJurisdiction: 'US',
    reviewedAt: '2026-01-01T00:00:00Z',
    notes: 'Reviewed text and completeness',
  },
} as Candidate;
const findUnique = jest.fn();
const upsert = jest.fn<
  Promise<unknown>,
  [{ where: unknown; create: unknown; update: unknown }]
>();
const update = jest.fn();
const tx = {
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  readingAsset: { findUnique, upsert, update },
};
const db = {
  $transaction: (action: (client: typeof tx) => Promise<unknown>) => action(tx),
} as unknown as CatalogDatabase;
beforeEach(() => jest.clearAllMocks());
it('rejects an unapproved READY event before writing anything', async () => {
  await expect(
    applyPublication(db, {
      candidate: { ...candidate, review: null },
      entryId: 'entry',
      revision: 1,
      status: 'READY',
    }),
  ).rejects.toThrow('approval');
  expect(upsert).not.toHaveBeenCalled();
});
it('ignores a delayed publication after a newer withdrawal', async () => {
  findUnique.mockResolvedValue({
    mainCatalogEntryId: 'entry',
    publicationRevision: 2,
  });
  expect(
    await applyPublication(db, {
      candidate,
      entryId: 'entry',
      revision: 1,
      status: 'READY',
    }),
  ).toEqual({ applied: false });
  expect(upsert).not.toHaveBeenCalled();
  expect(assertCandidateMapping).toHaveBeenCalled();
});
it('records a withdrawal tombstone even if it arrives before the first READY event', async () => {
  findUnique.mockResolvedValue(null);
  await applyPublication(db, {
    candidate,
    entryId: 'entry',
    revision: 2,
    status: 'WITHDRAWN',
  });
  expect(upsert.mock.calls[0][0].create).toMatchObject({
    status: 'WITHDRAWN',
    publicationRevision: 2,
  });
});

it('restores the same withdrawn identity with a newer reviewed publication revision', async () => {
  findUnique.mockResolvedValue({
    mainCatalogEntryId: 'entry',
    publicationRevision: 2,
    status: 'WITHDRAWN',
  });
  await expect(
    applyPublication(db, {
      candidate,
      entryId: 'entry',
      revision: 3,
      status: 'READY',
    }),
  ).resolves.toEqual({ applied: true });
  expect(upsert.mock.calls[0][0].update).toMatchObject({
    status: 'READY',
    publicationRevision: 3,
    mainCatalogEntryId: 'entry',
  });
});
