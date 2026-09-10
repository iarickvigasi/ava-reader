import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export function duplicateCollectionError() {
  return new BadRequestException({
    code: 'nameDuplicate',
    message: 'A collection with this name already exists.',
  });
}

// Serialize name checks with custom collection writes; retry concurrent slug/name races.
export async function collectionWrite<T>(
  prisma: PrismaService,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(write, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (attempt < 2 && (code === 'P2034' || code === 'P2002')) continue;
      if (code === 'P2002') throw duplicateCollectionError();
      throw error;
    }
  }
}
