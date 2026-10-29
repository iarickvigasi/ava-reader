import { providerDownload } from '../../reading-import/providers/provider-reference';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CatalogDatabase } from '../../database/catalog-database';
import type { Candidate } from '../../reading-import/types';
import { assertCandidateMapping } from '../../reading-import/assert-candidate-mapping';

export async function applyPublication(
  db: CatalogDatabase,
  body: {
    entryId: string;
    revision: number;
    status: 'READY' | 'WITHDRAWN';
    candidate: Candidate;
  },
) {
  const candidate = body?.candidate;
  if (
    !candidate ||
    !/^[\da-f-]{36}$/i.test(candidate.editionId) ||
    !/^[a-f\d]{64}$/.test(candidate.checksum ?? '') ||
    typeof body.entryId !== 'string' ||
    !body.entryId ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 1 ||
    !['READY', 'WITHDRAWN'].includes(body.status)
  )
    throw new BadRequestException('Invalid publication receipt');
  if (body.status === 'READY') {
    const review = candidate.review;
    if (
      !review ||
      review.sha256 !== candidate.checksum ||
      [
        review.reviewer,
        review.rightsStatement,
        review.rightsUrl,
        review.rightsJurisdiction,
        review.notes,
      ].some((value) => typeof value !== 'string' || !value.trim()) ||
      !/^https:\/\//.test(review.rightsUrl) ||
      !Number.isFinite(Date.parse(review.reviewedAt))
    )
      throw new BadRequestException('Missing publication approval');
  }
  return db.$transaction(async (tx) => {
    if (body.status === 'READY') {
      await tx.$queryRaw`SELECT id FROM "Work" WHERE id = ${candidate.workId}::uuid FOR UPDATE`;
      await assertCandidateMapping(tx, candidate);
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${candidate.editionId}:${candidate.checksum}`}))`;
    const where = {
      editionId_checksum: {
        editionId: candidate.editionId,
        checksum: candidate.checksum!,
      },
    };
    const existing = await tx.readingAsset.findUnique({ where });
    if (existing && existing.mainCatalogEntryId !== body.entryId)
      throw new ConflictException('Reading copy identity changed');
    if (existing && existing.publicationRevision >= body.revision)
      return { applied: false };
    if (body.status === 'WITHDRAWN' && (existing || !candidate.review)) {
      if (existing)
        await tx.readingAsset.update({
          where,
          data: { status: 'WITHDRAWN', publicationRevision: body.revision },
        });
      return { applied: true };
    }
    const review = candidate.review!;
    const data = {
      status: body.status,
      mainCatalogEntryId: body.entryId,
      publicationRevision: body.revision,
      mediaType: 'application/epub+zip',
      sourceUrl: providerDownload(candidate),
      reviewDeferred: review.reviewDeferred === true,
      rightsStatement: review.rightsStatement,
      rightsUrl: review.rightsUrl,
      rightsJurisdiction: review.rightsJurisdiction,
      reviewedAt: new Date(review.reviewedAt),
    };
    await tx.readingAsset.upsert({
      where,
      create: {
        editionId: candidate.editionId,
        checksum: candidate.checksum!,
        ...data,
      },
      update: data,
    });
    return { applied: true };
  });
}
