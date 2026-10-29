import { publishCollectionCopy } from './publish-collection-copy';
import { mainRequest } from '../main-request';
import { mainApi } from '../main-api';
import type { Candidate, MainStatus } from '../types';
jest.mock('../main-request');
jest.mock('../main-api');
const candidate = {
  title: 'Emma',
  authors: ['Jane Austen'],
  language: 'en',
  editionId: 'edition',
  checksum: 'a'.repeat(64),
} as Candidate;
const receipt = {
  id: 'entry',
  editionId: 'edition',
  checksum: candidate.checksum,
  status: 'PROCESSED',
} as MainStatus;
beforeEach(() => jest.resetAllMocks());
it('publishes the authorized collection without claiming completed review', async () => {
  jest
    .mocked(mainApi)
    .mockResolvedValue({ ...receipt, status: 'READY', syncPending: false });
  expect((await publishCollectionCopy(candidate, receipt)).status).toBe(
    'READY',
  );
  expect(mainRequest).toHaveBeenCalledWith(
    'reading-imports/publish',
    JSON.stringify({
      editionId: 'edition',
      checksum: candidate.checksum,
      review: { reviewDeferred: true },
    }),
  );
});
it.each(['WITHDRAWN', 'PENDING', 'FAILED', 'READY'] as const)(
  'does not automatically republish or override %s',
  async (status) => {
    expect(
      await publishCollectionCopy(candidate, { ...receipt, status }),
    ).toMatchObject({ status });
    expect(mainRequest).not.toHaveBeenCalled();
  },
);
it('does not grant collection policy by title alone', async () => {
  await publishCollectionCopy(
    { ...candidate, authors: ['Someone Else'] },
    receipt,
  );
  expect(mainRequest).not.toHaveBeenCalled();
});
it('preserves completed review when retrying pending synchronization', async () => {
  jest
    .mocked(mainApi)
    .mockResolvedValue({ ...receipt, status: 'READY', syncPending: false });
  await publishCollectionCopy(candidate, {
    ...receipt,
    status: 'READY',
    syncPending: true,
  });
  expect(mainRequest).toHaveBeenCalledWith(
    'reading-imports/publish',
    JSON.stringify({ editionId: 'edition', checksum: candidate.checksum }),
  );
});
