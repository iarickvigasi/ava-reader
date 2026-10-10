import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { reportId } from './event-contract';
const cursorSchema = z
  .object({
    version: z.literal(1),
    conversionId: reportId,
    watermark: z.number().int().nonnegative(),
    after: z.number().int().nonnegative(),
  })
  .strict();
export function eventPageCursor(
  conversionId: string,
  watermark: number,
  after: number,
) {
  return Buffer.from(
    JSON.stringify(
      cursorSchema.parse({ version: 1, conversionId, watermark, after }),
    ),
  ).toString('base64url');
}
export function parseEventPage(
  conversionId: string,
  latest: number,
  rawCursor?: string,
  rawLimit?: string,
) {
  const limit = rawLimit === undefined ? 50 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new BadRequestException('Invalid report page.');
  if (!rawCursor) return { watermark: latest, after: 0, limit };
  try {
    if (rawCursor.length > 1_024 || !/^[A-Za-z0-9_-]+$/.test(rawCursor))
      throw new Error();
    const cursor = cursorSchema.parse(
      JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')),
    );
    if (
      cursor.conversionId !== conversionId ||
      cursor.watermark > latest ||
      cursor.after > cursor.watermark
    )
      throw new Error();
    return { watermark: cursor.watermark, after: cursor.after, limit };
  } catch {
    throw new BadRequestException('Invalid report cursor.');
  }
}
