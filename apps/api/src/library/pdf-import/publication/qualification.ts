import type { PrismaService } from '../../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import {
  QUALIFIED_READER_BUILDS,
  type QualifiedReaderBuild,
} from './qualification-catalog';
import { PdfPublicationError } from './errors';
export async function registerReaderQualification(
  prisma: PrismaService,
  input: QualifiedReaderBuild,
  evidence: Prisma.InputJsonValue,
  testOnly = false,
) {
  const spec = structuredClone(input);
  if (
    ![
      spec.readerBuildFingerprint,
      spec.adapterFingerprint,
      spec.reportSha256,
    ].every((x) => /^[a-f0-9]{64}$/.test(x))
  )
    throw new PdfPublicationError('PDF_READER_NOT_QUALIFIED');
  const approved = QUALIFIED_READER_BUILDS.some(
    (row) => JSON.stringify(row) === JSON.stringify(spec),
  );
  if (
    !approved &&
    !(
      testOnly &&
      process.env.NODE_ENV === 'test' &&
      process.env.AVA_PDF_TEST_HOOKS === '1'
    )
  )
    throw new PdfPublicationError('PDF_READER_NOT_QUALIFIED');
  const evidenceKind = approved ? 'PRODUCT' : 'TEST';
  const row = await prisma.pdfReaderQualification.upsert({
    where: {
      readerBuildFingerprint_adapterFingerprint_reportSha256: {
        readerBuildFingerprint: spec.readerBuildFingerprint,
        adapterFingerprint: spec.adapterFingerprint,
        reportSha256: spec.reportSha256,
      },
    },
    create: { ...spec, evidenceKind, evidence },
    update: {},
  });
  if (
    row.evidenceKind !== evidenceKind ||
    JSON.stringify(row.capabilities) !== JSON.stringify(spec.capabilities)
  )
    throw new PdfPublicationError('PDF_READER_QUALIFICATION_CONFLICT');
  return row;
}
export async function requireReaderQualification(
  prisma: Pick<PrismaService, 'pdfReaderQualification'>,
  id: string,
  capabilities: string[],
) {
  const row = await prisma.pdfReaderQualification.findUnique({ where: { id } });
  if (
    !row ||
    row.revokedAt ||
    !['TEST', 'PRODUCT'].includes(row.evidenceKind) ||
    row.schemaVersion !== 'ava-reader-3' ||
    capabilities.some((c) => !row.capabilities.includes(c)) ||
    (row.evidenceKind === 'TEST' &&
      (process.env.NODE_ENV !== 'test' ||
        process.env.AVA_PDF_TEST_HOOKS !== '1')) ||
    (row.evidenceKind === 'PRODUCT' &&
      !QUALIFIED_READER_BUILDS.some(
        (c) =>
          c.readerBuildFingerprint === row.readerBuildFingerprint &&
          c.adapterFingerprint === row.adapterFingerprint &&
          c.reportSha256 === row.reportSha256 &&
          JSON.stringify(c.capabilities) === JSON.stringify(row.capabilities),
      ))
  )
    throw new PdfPublicationError('PDF_READER_NOT_QUALIFIED');
  return row;
}
