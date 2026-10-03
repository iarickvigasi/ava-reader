import { BlobPurpose } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { WorkerResultV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-worker-result-1';
import { toPrismaBytes } from '../../../shared/blob-utils';
import { PDF_IMPORT_PROFILE } from '../admission/profile';
import { resultArtifacts, type ArtifactBytes } from './result-artifacts';
export async function stageArtifacts(
  prisma: PrismaService,
  ownerId: string,
  result: WorkerResultV1,
  bytes: ArtifactBytes[],
) {
  const entries: [string, string][] = [];
  for (const descriptor of resultArtifacts(result)) {
    const content = bytes.find((value) => value.id === descriptor.id)!;
    const artifact = await prisma.pdfArtifact.create({
      data: {
        owner: { connect: { id: ownerId } },
        role: descriptor.role,
        retention: 'STAGING',
        expiresAt: new Date(Date.now() + PDF_IMPORT_PROFILE.stagingTtlMs),
        checksum: descriptor.sha256,
        sizeBytes: descriptor.byte_length,
        mimeType: descriptor.media_type,
        blob: {
          create: {
            purpose: BlobPurpose.PDF_ARTIFACT,
            bytes: toPrismaBytes(content.bytes),
            checksum: descriptor.sha256,
            sizeBytes: descriptor.byte_length,
            mimeType: descriptor.media_type,
            originalFilename: descriptor.path.split('/').at(-1) ?? 'artifact',
          },
        },
      },
    });
    entries.push([descriptor.id, artifact.id]);
  }
  return Object.fromEntries(entries);
}
