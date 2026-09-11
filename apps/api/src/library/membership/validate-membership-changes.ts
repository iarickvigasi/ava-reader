import { BadRequestException } from '@nestjs/common';
import type { MembershipChanges } from './types';

export function validateMembershipChanges(input: unknown): MembershipChanges {
  const invalid = () =>
    new BadRequestException({
      code: 'invalidMembershipChanges',
      message: 'Supply disjoint arrays of collection IDs to add and remove.',
    });
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid();
  }
  const body = input as Record<string, unknown>;
  const lists = [body.addCollectionIds, body.removeCollectionIds];
  if (
    lists.some(
      (list) =>
        !Array.isArray(list) ||
        list.some(
          (id: unknown) =>
            typeof id !== 'string' || !id.trim() || id !== id.trim(),
        ),
    )
  ) {
    throw invalid();
  }
  const addCollectionIds = [...new Set(body.addCollectionIds as string[])];
  const removeCollectionIds = [
    ...new Set(body.removeCollectionIds as string[]),
  ];
  const additions = new Set(addCollectionIds);
  if (removeCollectionIds.some((id) => additions.has(id))) throw invalid();
  return { addCollectionIds, removeCollectionIds };
}
