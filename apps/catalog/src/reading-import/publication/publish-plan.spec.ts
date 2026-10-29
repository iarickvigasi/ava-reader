import { mainRequest } from '../main-request';
import { publishApproval } from './publish-plan';
import { approvalFixture as approval } from './approval-fixture';
jest.mock('../main-request');
const request = jest.mocked(mainRequest);
const receipt = (status: string) => ({
  id: 'entry',
  editionId: approval.editionId,
  checksum: approval.checksum,
  syncPending: false,
  status,
});
beforeEach(() => jest.resetAllMocks());
it('publishes only a processed copy through the normal admin endpoint', async () => {
  request
    .mockResolvedValueOnce(receipt('PROCESSED'))
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(receipt('READY'));
  expect(await publishApproval(approval)).toBe('published');
  expect(request.mock.calls[1]).toEqual([
    'reading-imports/publish',
    JSON.stringify({
      editionId: approval.editionId,
      checksum: approval.checksum,
      review: approval.review,
    }),
  ]);
});
it.each(['PENDING', 'FAILED', 'WITHDRAWN'])(
  'never publishes %s copies',
  async (status) => {
    request.mockResolvedValueOnce(receipt(status));
    await expect(publishApproval(approval)).rejects.toThrow('not eligible');
    expect(request).toHaveBeenCalledTimes(1);
  },
);
it('does not repeat completed publication', async () => {
  request.mockResolvedValueOnce(receipt('READY'));
  expect(await publishApproval(approval)).toBe('already-published');
  expect(request).toHaveBeenCalledTimes(1);
});
it('rejects mismatched receipt identity before publication', async () => {
  request.mockResolvedValueOnce({
    ...receipt('PROCESSED'),
    checksum: 'b'.repeat(64),
  });
  await expect(publishApproval(approval)).rejects.toThrow('does not match');
  expect(request).toHaveBeenCalledTimes(1);
});
it('reports failed delivery for retry, without calling it success', async () => {
  request
    .mockResolvedValueOnce(receipt('PROCESSED'))
    .mockRejectedValueOnce(new Error('HTTP 503'));
  await expect(publishApproval(approval)).rejects.toThrow('503');
});

it('retries synchronization for a published copy instead of skipping pending delivery', async () => {
  request
    .mockResolvedValueOnce({ ...receipt('READY'), syncPending: true })
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(receipt('READY'));
  expect(await publishApproval(approval)).toBe('published');
  expect(request).toHaveBeenCalledTimes(3);
});

it('never reports pending Catalog delivery as completed', async () => {
  request
    .mockResolvedValueOnce(receipt('PROCESSED'))
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({ ...receipt('READY'), syncPending: true });
  await expect(publishApproval(approval)).rejects.toThrow('not confirmed');
});
