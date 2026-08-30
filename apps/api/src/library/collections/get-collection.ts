import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { serializeCollection } from './serialize-collection';

// GET /library/collections/:ref — reads by collection id or slug.
export async function getCollection(options: {
  prisma: PrismaService;
  ref: string;
  userId: string;
}) {
  const collection = await options.prisma.collection.findFirst({
    where: {
      userId: options.userId,
      OR: [{ id: options.ref }, { slug: options.ref }],
    },
    include: {
      items: {
        include: {
          libraryItem: {
            include: {
              book: {
                include: {
                  coverBlob: { select: { mimeType: true } },
                  // readingProgressIndex on BookFile is a per-position
                  // progress map (see schema.prisma) — multi-KB per file
                  // and never rendered on this screen. Pick only the
                  // scalars we need.
                  files: {
                    select: { format: true, isPrimary: true, kind: true },
                  },
                },
              },
              progress: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    throw new NotFoundException('Collection not found.');
  }

  return {
    collection: serializeCollection(collection),
  };
}
