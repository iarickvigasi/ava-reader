import { Prisma } from '@prisma/client';
import { fixture } from './catalog-link-fixture';
import { saveCatalogLink } from './save-catalog-link';
import { loadCatalogLink } from './load-catalog-link';
jest.mock('./load-catalog-link');
const workId = '00000000-0000-4000-8000-000000000001';
const mutationId = '00000000-0000-4000-8000-000000000002';
const link = {
  workId,
  title: 'Classic',
  authors: ['Author'],
  revision: 1,
};
const body = { mutationId, version: 0, workId };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadCatalogLink).mockResolvedValue(link);
});
it('checks private ownership and changes only description fields with a version fence', async () => {
  const f = fixture();
  await expect(
    saveCatalogLink(f.prisma, 'owner', 'copy', body),
  ).resolves.toEqual({ link, version: 1 });
  expect(f.findFirst).toHaveBeenCalledWith({
    where: {
      id: 'copy',
      userId: 'owner',
      source: 'IMPORTED',
      book: { visibility: 'PRIVATE', privateOwnerId: 'owner' },
    },
  });
  expect(f.updateMany.mock.calls[0]).toMatchObject([
    {
      where: { catalogLinkVersion: 0 },
      data: {
        catalogLink: link,
        catalogLinkMutationId: mutationId,
        catalogLinkVersion: { increment: 1 },
      },
    },
  ]);
});
it('never queries Catalog for another user’s copy', async () => {
  const f = fixture(null);
  await expect(
    saveCatalogLink(f.prisma, 'other', 'copy', body),
  ).rejects.toThrow('not found');
  expect(loadCatalogLink).not.toHaveBeenCalled();
  expect(f.updateMany).not.toHaveBeenCalled();
});
it('unlinks without deleting the upload or requiring Catalog availability', async () => {
  const f = fixture();
  await saveCatalogLink(f.prisma, 'owner', 'copy', { ...body, workId: null });
  expect(loadCatalogLink).not.toHaveBeenCalled();
  expect(f.updateMany.mock.calls[0]).toMatchObject([
    {
      data: {
        catalogLink: Prisma.DbNull,
        catalogLinkMutationId: mutationId,
        catalogLinkVersion: { increment: 1 },
      },
    },
  ]);
});
it('returns the accepted result for a replay and rejects malformed IDs', async () => {
  const f = fixture({
    catalogLinkMutationId: mutationId,
    catalogLinkVersion: 1,
    catalogLink: link,
  });
  await expect(
    saveCatalogLink(f.prisma, 'owner', 'copy', body),
  ).resolves.toEqual({ link, version: 1 });
  expect(f.updateMany).not.toHaveBeenCalled();
  expect(loadCatalogLink).not.toHaveBeenCalled();
  await expect(
    saveCatalogLink(f.prisma, 'owner', 'copy', { ...body, workId: 'bad' }),
  ).rejects.toThrow('Invalid');
});
it('preserves the link when the edition mismatches or a newer mutation already won', async () => {
  const f = fixture();
  jest.mocked(loadCatalogLink).mockRejectedValue(new Error('Edition mismatch'));
  await expect(
    saveCatalogLink(f.prisma, 'owner', 'copy', body),
  ).rejects.toThrow('mismatch');
  expect(f.updateMany).not.toHaveBeenCalled();
  await expect(
    saveCatalogLink(
      fixture({ catalogLinkVersion: 1, catalogLink: link }).prisma,
      'owner',
      'copy',
      body,
    ),
  ).rejects.toThrow('another device');
});
