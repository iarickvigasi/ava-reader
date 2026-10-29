import { validProviderIdentity } from './provider-identity';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { reviewSchema } from './review-schema';

const checksum = z.string().regex(/^[a-f\d]{64}$/);
const nonempty = z.string().trim().min(1).max(4000);
const reviewedDate = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Date.parse(value) <= Date.now());
const schema = z
  .object({
    sourceKey: z.enum(['open-library', 'curated-classics']).optional(),
    editionId: z.string().uuid(),
    workId: z.string().uuid(),
    externalId: nonempty,
    sourceRevision: z.string().regex(/^\d+$/),
    sourcePayloadHash: checksum,
    title: nonempty,
    authors: z.array(nonempty).min(1).max(30),
    language: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/),
    iaIdentifier: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/)
      .optional(),
    provider: z
      .enum(['internet-archive', 'standard-ebooks', 'wolne-lektury'])
      .optional(),
    providerId: nonempty.optional(),
    sourceUrl: z.string().url().optional(),
    downloadUrl: z.string().url().optional(),
    filename: nonempty.refine(
      (name) =>
        /\.epub$/i.test(name) &&
        !name.includes('..') &&
        !name.includes('\\') &&
        ![...name].some((char) => char.charCodeAt(0) < 32),
    ),
    checksum,
    metadata: z.record(z.unknown()),
    metadataBlobId: z.string().uuid().optional(),
    fileMetadata: z.record(z.unknown()),
    inspectedAt: reviewedDate,
    review: reviewSchema.nullish(),
  })
  .refine(validProviderIdentity, 'Invalid source identity')
  .refine(
    (value) => !value.review || value.checksum === value.review.sha256,
    'Approval must bind the exact EPUB checksum',
  );

export type ImportManifest = z.infer<typeof schema>;
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export function parseImportManifest(value: string): ImportManifest {
  try {
    return schema.parse(JSON.parse(value));
  } catch {
    throw new BadRequestException('Invalid file-bound rights/quality manifest');
  }
}
