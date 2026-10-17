import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const text = z.string().trim().min(1).max(1000);
const metadata = z
  .object({
    expectedVersion: z.number().int().nonnegative().max(2147483646),
    title: text.optional(),
    authors: z.array(text).max(100).optional(),
    language: z.string().trim().min(2).max(35).nullable().optional(),
  })
  .strict()
  .refine((value) =>
    ['title', 'authors', 'language'].some((key) => key in value),
  );
export function parsePdfMetadata(value: unknown) {
  const result = metadata.safeParse(value);
  if (!result.success)
    throw new BadRequestException('Invalid metadata update.');
  return result.data;
}
