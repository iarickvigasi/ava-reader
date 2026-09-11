import type { PrismaService } from '../../prisma/prisma.service';

export type MembershipChanges = {
  addCollectionIds: string[];
  removeCollectionIds: string[];
};

export type MembershipUpdateOptions = {
  input: unknown;
  libraryItemId: string;
  prisma: PrismaService;
  userId: string;
};
