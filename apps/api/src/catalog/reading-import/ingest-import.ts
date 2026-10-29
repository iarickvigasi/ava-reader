import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { parseImportManifest } from './manifest';
import { importKey } from './import-key';
import { createImport } from './create-import';
import { loadImport } from './load-import';
import { assertReplayManifest } from './assert-replay-manifest';
export async function ingestImport(
  prisma: PrismaService,
  actorId: string | null,
  json: string,
  file: Express.Multer.File,
) {
  const manifest = parseImportManifest(json);
  const key = importKey(manifest.editionId, manifest.checksum);
  const existing = await prisma.catalogEntry.findUnique({
    where: { importKey: key },
    select: { id: true },
  });
  if (!existing) {
    try {
      await createImport(prisma, actorId, manifest, file);
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      )
        throw error;
    }
  }
  const result = await loadImport(
    prisma,
    manifest.editionId,
    manifest.checksum,
  );
  assertReplayManifest(result.entry.importEvidence, manifest);
  return result.receipt;
}
