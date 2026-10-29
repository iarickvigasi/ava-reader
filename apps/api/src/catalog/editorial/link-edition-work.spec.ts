import { linkEditionWork } from './link-edition-work';
import { catalogEditorialRequest } from './catalog-editorial-request';
import type { PrismaService } from '../../prisma/prisma.service';
jest.mock('./catalog-editorial-request');
it('repairs public review pointers without reading or writing private library associations', async () => {
  const execute = jest.fn();
  const prisma = { $executeRaw: execute } as unknown as PrismaService;
  jest
    .mocked(catalogEditorialRequest)
    .mockResolvedValue({ editionId: 'edition', workId: 'work' });
  await linkEditionWork(prisma, {
    editionId: 'edition',
    workId: 'work',
    revision: 1,
    workRevision: 2,
  });
  expect(execute).toHaveBeenCalledTimes(1);
  const [sql] = execute.mock.calls[0] as [TemplateStringsArray];
  expect(sql.join('')).toContain('UPDATE "CatalogEntry"');
  expect(sql.join('')).not.toContain('LibraryItem');
});
