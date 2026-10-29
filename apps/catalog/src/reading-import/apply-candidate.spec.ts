import { publishCollectionCopy } from './publication/publish-collection-copy';
jest.mock('./publication/publish-collection-copy', () => ({
  publishCollectionCopy: jest.fn(
    (_candidate: unknown, status: unknown) => status,
  ),
}));
import { recordImportEvidence } from './evidence/record-import-evidence';
jest.mock('./evidence/record-import-evidence', () => ({
  recordImportEvidence: jest.fn(),
}));
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { candidateFixture } from './candidate-fixture';
import { applyCandidate } from './apply-candidate';
import { fetchArchive } from './fetch-archive';
import { mainApi } from './main-api';
import type { Candidate } from './types';
import type { CatalogDatabase } from '../database/catalog-database';

jest.mock('./fetch-archive');
jest.mock('./main-api');
jest.mock('./assert-candidate-mapping');
const upsert = jest.fn<
  Promise<unknown>,
  [{ where: unknown; create: unknown; update: unknown }]
>();
const update = jest.fn();
const findUnique = jest.fn();
const db = {
  readingAsset: { upsert, update, findUnique },
} as unknown as CatalogDatabase;
let directory: string;
let candidate: Candidate;
beforeEach(async () => {
  jest.resetAllMocks();
  directory = await mkdtemp(join(tmpdir(), 'ava-reading-'));
  const fixture = await candidateFixture(directory);
  candidate = fixture.candidate;
  const { bytes } = fixture;
  jest.mocked(fetchArchive).mockResolvedValue(
    Buffer.from(
      JSON.stringify({
        metadata: { mediatype: 'texts' },
        files: [
          {
            name: 'classic.epub',
            size: String(bytes.length),
            md5: createHash('md5').update(bytes).digest('hex'),
            format: 'EPUB',
          },
        ],
      }),
    ),
  );
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
it('stages the copy and delegates publication to the collection policy', async () => {
  jest
    .mocked(publishCollectionCopy)
    .mockImplementation((_candidate, status) => Promise.resolve(status));
  candidate.review = null;
  const receipt = {
    id: 'entry',
    editionId: 'edition',
    checksum: candidate.checksum!,
    status: 'PROCESSED' as const,
  };
  jest.mocked(mainApi).mockResolvedValue(receipt);
  expect(await applyCandidate(db, candidate)).toEqual(receipt);
  expect(mainApi).toHaveBeenCalledTimes(1);
  expect(recordImportEvidence).toHaveBeenCalledWith(db, candidate, undefined);
  expect(publishCollectionCopy).toHaveBeenCalledWith(candidate, receipt);
  expect(upsert).not.toHaveBeenCalled();
  await applyCandidate(db, candidate);
  expect(upsert).not.toHaveBeenCalled();
});
it('reports processing failures without advertising a readable copy', async () => {
  jest.mocked(mainApi).mockResolvedValue({
    id: 'entry',
    editionId: 'edition',
    checksum: candidate.checksum!,
    status: 'FAILED',
    error: 'Broken EPUB',
  });
  await expect(applyCandidate(db, candidate)).rejects.toThrow('Broken EPUB');
  expect(recordImportEvidence).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});
