import { catalogSignedRequest } from '../catalog-signed-request';
import type { PrismaService } from '../../prisma/prisma.service';
import { parseImportManifest } from '../reading-import/manifest';
import { loadImport } from '../reading-import/load-import';

export async function syncPublication(prisma: PrismaService, entryId: string) {
  const entry = await prisma.catalogEntry.findUniqueOrThrow({
    where: { id: entryId },
  });
  if (!entry.importSyncPending || !entry.importKey) return;
  const manifest = parseImportManifest(JSON.stringify(entry.importEvidence));
  const current = await loadImport(
    prisma,
    manifest.editionId,
    manifest.checksum,
  );
  const candidate = {
    ...manifest,
    metadata: undefined,
    fileMetadata: undefined,
  };
  const payload = {
    candidate,
    entryId,
    revision: entry.importSyncRevision,
    status: current.receipt.status === 'READY' ? 'READY' : 'WITHDRAWN',
  };
  const response = await catalogSignedRequest(
    'reading-assets/publication',
    payload,
    { timeout: 10_000 },
  );
  if (!response.ok)
    throw new Error(`Catalog synchronization failed (${response.status})`);
  const acknowledgement = (await response.json()) as {
    entryId?: string;
    revision?: number;
    applied?: boolean;
  };
  if (
    acknowledgement.entryId !== entry.id ||
    acknowledgement.revision !== entry.importSyncRevision ||
    typeof acknowledgement.applied !== 'boolean'
  )
    throw new Error('Invalid publication acknowledgement');
  await prisma.catalogEntry.updateMany({
    where: { id: entry.id, importSyncRevision: entry.importSyncRevision },
    data: { importSyncPending: false },
  });
}
