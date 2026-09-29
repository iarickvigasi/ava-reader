import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SemanticValidator } from '../../pdf-conversion/contracts/types';
import { validateContract } from '../../pdf-conversion/contracts/validate-contract';
import { checksumBuffer } from '../../shared/blob-utils';
import { requireReaderQualification } from '../pdf-import/publication/qualification';
import { activateImportedRecord } from './activate-record';
export async function activateCanonicalEpub(
  prisma: PrismaService,
  semantic: SemanticValidator,
  qualificationId = process.env.AVA_EPUB_READER_QUALIFICATION_ID ??
    process.env.AVA_PDF_READER_QUALIFICATION_ID,
) {
  if (!qualificationId) return false;
  const qualification = await requireReaderQualification(
    prisma,
    qualificationId,
    [],
  );
  const candidates = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT i.id FROM "CanonicalEpubImport" i
    WHERE NOT EXISTS (SELECT 1 FROM "CanonicalEpubAcceptance" a WHERE a."importId"=i.id)
      AND jsonb_typeof(i."validationReport"->'required_capabilities')='array'
      AND i."validationReport"->'required_capabilities' <@ ${JSON.stringify(qualification.capabilities)}::jsonb
    ORDER BY i."createdAt" ASC LIMIT 1`);
  if (!candidates.length) return false;
  const record = await prisma.canonicalEpubImport.findUniqueOrThrow({
    where: { id: candidates[0].id },
    include: { readerFile: { include: { blob: true } } },
  });
  const bytes = Buffer.from(record.readerFile.blob.bytes);
  if (checksumBuffer(bytes) !== record.readerSha256)
    throw new Error('EPUB_IMPORT_CONTENT_CHANGED');
  const reader = await validateContract('ava-reader-3', bytes, semantic);
  await requireReaderQualification(
    prisma,
    qualificationId,
    reader.required_capabilities,
  );
  return activateImportedRecord(prisma, record, reader, qualificationId);
}
