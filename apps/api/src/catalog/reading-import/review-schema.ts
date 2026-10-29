import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

const text = z.string().trim().min(1).max(4000);
const date = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Date.parse(value) <= Date.now());
export const reviewSchema = z.object({
  reviewDeferred: z.boolean().optional(),
  sha256: z.string().regex(/^[a-f\d]{64}$/),
  reviewer: text,
  rightsStatement: text,
  rightsUrl: z.string().url().startsWith('https://'),
  rightsJurisdiction: text,
  reviewedAt: date,
  qualityReviewedAt: date,
  notes: text,
});
export function parseReview(
  value: unknown,
  checksum: string,
  reviewer: string,
  sourceUrl = 'https://archive.org/',
) {
  const now = new Date().toISOString();
  const input = value && typeof value === 'object' ? value : {};
  if ('reviewDeferred' in input && input.reviewDeferred === true)
    return reviewSchema.parse({
      sha256: checksum,
      reviewer,
      reviewDeferred: true,
      rightsStatement:
        'Administrator authorized publication; rights and quality review pending.',
      rightsUrl: sourceUrl,
      rightsJurisdiction: 'Not reviewed',
      reviewedAt: now,
      qualityReviewedAt: now,
      notes:
        'Publication authorized before review; timestamps record authorization only.',
    });
  if (
    !('rightsConfirmed' in input) ||
    input.rightsConfirmed !== true ||
    !('qualityConfirmed' in input) ||
    input.qualityConfirmed !== true
  )
    throw new BadRequestException(
      'Confirm rights and reading quality before publication',
    );
  const result = reviewSchema.safeParse({
    ...input,
    sha256: checksum,
    reviewer,
    reviewedAt: now,
    qualityReviewedAt: now,
  });
  if (!result.success)
    throw new BadRequestException(
      'Rights evidence, jurisdiction, and quality review are required',
    );
  return result.data;
}
