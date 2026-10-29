import { publishImport } from './publish-import';
import { loadImport } from './load-import';
import { loadReaderPackage } from '../../reader/package/load-reader-package';
import { importFixture } from './import-fixture';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ReaderPackage } from '../../reader/reader-types';

jest.mock('./load-import');
jest.mock('../../reader/package/load-reader-package');
it.each(['PROCESSED', 'WITHDRAWN', 'READY'])(
  'requires fresh explicit review for %s and queues signed delivery',
  async (status) => {
    const updateMany = jest
      .fn<Promise<{ count: number }>, [{ data: unknown; where: unknown }]>()
      .mockResolvedValue({ count: 1 });
    const db = { catalogEntry: { updateMany } } as unknown as PrismaService;
    const loaded = {
      entry: {
        id: 'entry',
        status: status === 'WITHDRAWN' ? 'ARCHIVED' : 'DRAFT',
        importSyncRevision: 3,
        importEvidence: importFixture,
      },
      processed: true,
      source: { id: 'source' },
      output: { id: 'output', blobId: 'blob' },
      receipt: { status },
    } as unknown as Awaited<ReturnType<typeof loadImport>>;
    jest.mocked(loadImport).mockResolvedValue(loaded);
    jest.mocked(loadReaderPackage).mockResolvedValue({
      manifest: { sourceChecksum: importFixture.checksum },
      toc: [{}],
      chapters: [
        {
          blocks: Array.from({ length: 5 }, () => ({
            kind: 'paragraph',
            text: 'Readable prose. '.repeat(50),
          })),
        },
      ],
    } as ReaderPackage);
    await expect(
      publishImport(db, importFixture.editionId, importFixture.checksum, {}),
    ).rejects.toThrow('Confirm rights');
    expect(updateMany).not.toHaveBeenCalled();
    const load = jest.mocked(loadImport);
    load.mockResolvedValueOnce(loaded).mockResolvedValueOnce({
      ...loaded,
      receipt: { ...loaded.receipt, status: 'READY' },
    });
    await publishImport(
      db,
      importFixture.editionId,
      importFixture.checksum,
      {
        ...importFixture.review,
        reviewer: 'forged',
        rightsConfirmed: true,
        qualityConfirmed: true,
      },
      'actual-admin',
    );
    const saved = updateMany.mock.calls[0][0].data as {
      importEvidence: { review: { reviewer: string; sha256: string } };
    };
    expect(saved).toMatchObject({
      status: 'PUBLISHED',
      importSyncPending: true,
      importSyncRevision: { increment: 1 },
    });
    expect(saved.importEvidence.review).toMatchObject({
      reviewer: 'actual-admin',
      sha256: importFixture.checksum,
    });
  },
);
