import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { isPrismaUniqueConstraintError } from '../../shared/prisma-errors';

// PATCH /library/collections/:id
// (docs/specs/3-library/3.3-collections.md §3).
export async function renameCollection(options: {
  collectionId: string;
  input: {
    description?: null | string;
    name?: string;
  };
  prisma: PrismaService;
  userId: string;
}) {
  const name = options.input.name?.trim() ?? '';

  if (!name) {
    throw new BadRequestException('Collection name is required.');
  }

  const collection = await options.prisma.collection.findFirst({
    where: {
      id: options.collectionId,
      userId: options.userId,
    },
    select: {
      description: true,
      id: true,
      kind: true,
    },
  });

  if (!collection) {
    throw new NotFoundException('Collection not found.');
  }

  if (collection.kind === 'SMART') {
    throw new ForbiddenException('Smart collections cannot be renamed.');
  }

  const description =
    options.input.description === undefined
      ? collection.description
      : normalizeCollectionDescription(options.input.description);

  try {
    const renamed = await options.prisma.collection.update({
      where: {
        id: collection.id,
      },
      data: {
        description,
        name,
      },
      select: {
        description: true,
        id: true,
        name: true,
      },
    });

    return {
      collectionId: renamed.id,
      description: renamed.description,
      name: renamed.name,
    };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new BadRequestException(
        'A collection with this name already exists.',
      );
    }

    throw error;
  }
}

function normalizeCollectionDescription(rawDescription: null | string) {
  const trimmed = rawDescription?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
