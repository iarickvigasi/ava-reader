import { fixture } from './catalog-link-fixture';
import { saveCatalogLink } from './save-catalog-link';
import { loadCatalogLink } from './load-catalog-link';
jest.mock('./load-catalog-link');
const workId = '00000000-0000-4000-8000-000000000001';
const body = { workId, mutationId: workId, version: 0 };
it('rejects exact edition selection', async () => {
  const f = fixture();
  await expect(
    saveCatalogLink(f.prisma, 'owner', 'copy', { ...body, editionId: workId }),
  ).rejects.toThrow('Invalid');
  expect(loadCatalogLink).not.toHaveBeenCalled();
});
