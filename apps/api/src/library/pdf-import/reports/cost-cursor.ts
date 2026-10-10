import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
import { reportId } from './event-contract';
const schema = z
  .object({
    conversionId: reportId,
    watermark: z.string().regex(/^[a-f0-9]{64}$/),
    offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export function costCursor(
  conversionId: string,
  watermark: string,
  offset: number,
) {
  return Buffer.from(
    JSON.stringify(schema.parse({ conversionId, watermark, offset })),
  ).toString('base64url');
}
export function costPage(
  conversionId: string,
  watermark: string,
  cursor?: string,
  rawLimit?: string,
) {
  const limit = rawLimit === undefined ? 50 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new BadRequestException('Invalid cost page.');
  if (!cursor) return { offset: 0, limit };
  let value: z.infer<typeof schema>;
  try {
    if (cursor.length > 1_024 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new Error();
    value = schema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
  } catch {
    throw new BadRequestException('Invalid cost cursor.');
  }
  if (value.conversionId !== conversionId)
    throw new BadRequestException('Invalid cost cursor.');
  if (value.watermark !== watermark)
    throw new ConflictException('Cost projection changed. Restart its pages.');
  return { offset: value.offset, limit };
}
