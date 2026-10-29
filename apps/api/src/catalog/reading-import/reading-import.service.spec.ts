import { ReadingImportService } from './reading-import.service';
import { createImport } from './create-import';
import { loadImport } from './load-import';
import { importFixture } from './import-fixture';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';

jest.mock('./create-import');
jest.mock('./load-import');
const findUnique = jest.fn();
const assertAdmin = jest.fn();
const service = new ReadingImportService(
  { catalogEntry: { findUnique } } as unknown as PrismaService,
  { assertAdmin } as unknown as UsersService,
);
beforeEach(() => {
  jest.resetAllMocks();
  assertAdmin.mockResolvedValue({ id: 'admin' });
  jest.mocked(loadImport).mockResolvedValue({
    receipt: { id: 'entry' },
    entry: { importEvidence: importFixture },
  } as unknown as Awaited<ReturnType<typeof loadImport>>);
});
it('checks admin authorization before lookup or writes', async () => {
  assertAdmin.mockRejectedValue(new Error('Forbidden'));
  await expect(
    service.ingest(
      'other',
      JSON.stringify(importFixture),
      {} as Express.Multer.File,
    ),
  ).rejects.toThrow('Forbidden');
  expect(findUnique).not.toHaveBeenCalled();
  expect(createImport).not.toHaveBeenCalled();
});
it('replays an existing identity without another Book or processing run', async () => {
  findUnique.mockResolvedValue({ id: 'entry' });
  await service.ingest(
    'admin',
    JSON.stringify(importFixture),
    {} as Express.Multer.File,
  );
  expect(createImport).not.toHaveBeenCalled();
  expect(loadImport).toHaveBeenCalled();
});
it('creates a new import once and leaves publication to the processing gate', async () => {
  findUnique.mockResolvedValue(null);
  await service.ingest(
    'admin',
    JSON.stringify(importFixture),
    {} as Express.Multer.File,
  );
  expect(createImport).toHaveBeenCalledTimes(1);
});
