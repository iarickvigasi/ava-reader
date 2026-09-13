import { BadRequestException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { PrismaService } from '../../prisma/prisma.service';

const inputSchema = z
  .object({ finishedAt: z.string().datetime({ offset: true }).nullable() })
  .strict();

// Store the explicit client value so retries and delayed offline sync retain
// the original finish date. Clearing it has no effect on reading progress.
export async function setFinishedAt(options: {
  input: unknown;
  libraryItemId: string;
  prisma: PrismaService;
  userId: string;
}) {
  const parsed = inputSchema.safeParse(options.input);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'finishedAtInvalid',
      message: 'Finish date must be an ISO timestamp with a timezone, or null.',
    });
  }

  const where = {
    id: options.libraryItemId,
    isArchived: false,
    userId: options.userId,
  };
  const item = await options.prisma.libraryItem.findFirst({
    where,
    select: { id: true },
  });
  if (!item) {
    throw new NotFoundException('Book not found in library.');
  }

  const updated = await options.prisma.libraryItem.update({
    where,
    data: {
      finishedAt:
        parsed.data.finishedAt === null
          ? null
          : new Date(parsed.data.finishedAt),
    },
    select: { id: true, finishedAt: true },
  });
  return {
    libraryItemId: updated.id,
    finishedAt: updated.finishedAt?.toISOString() ?? null,
  };
}
