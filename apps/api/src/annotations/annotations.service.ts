import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { requireOwnedLibraryItem } from '../shared/owned-library-item';
import { parseLocator } from '../shared/parse-locator';

export type AnnotationListItem = {
  id: string;
  excerpt: string;
  highlightColor: string | null;
  locator: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type UpsertInput = {
  clerkUserId: string;
  libraryItemId: string;
  id: string;
  excerpt: string;
  highlightColor: string;
  locator: string | null;
};

type DeleteInput = {
  clerkUserId: string;
  libraryItemId: string;
  id: string;
};

@Injectable()
export class AnnotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async list(
    clerkUserId: string,
    libraryItemId: string,
  ): Promise<AnnotationListItem[]> {
    const owned = await this.ownedLibraryItem(clerkUserId, libraryItemId);

    const rows = await this.prisma.annotation.findMany({
      where: { userId: owned.userId, libraryItemId: owned.libraryItemId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        excerpt: true,
        highlightColor: true,
        locator: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => ({
      ...row,
      locator: parseLocator(row.locator, 'Annotation'),
    }));
  }

  // Idempotent create-or-update keyed by client-generated id. The offline
  // queue may replay the same write after the server already persisted it, so
  // we can't 409 on conflict. We do verify ownership: if the row exists but
  // belongs to another user (i.e. id collision across accounts), we treat it
  // as a fresh row and 404 on update so the queue stops retrying.
  async upsert(input: UpsertInput): Promise<AnnotationListItem> {
    const owned = await this.ownedLibraryItem(
      input.clerkUserId,
      input.libraryItemId,
    );

    const existing = await this.prisma.annotation.findUnique({
      where: { id: input.id },
      select: { userId: true, libraryItemId: true },
    });
    if (
      existing &&
      (existing.userId !== owned.userId ||
        existing.libraryItemId !== owned.libraryItemId)
    ) {
      throw new NotFoundException('Annotation not found.');
    }

    const row = await this.prisma.annotation.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        userId: owned.userId,
        libraryItemId: owned.libraryItemId,
        excerpt: input.excerpt,
        highlightColor: input.highlightColor,
        locator: input.locator,
      },
      update: {
        excerpt: input.excerpt,
        highlightColor: input.highlightColor,
        locator: input.locator,
      },
      select: {
        id: true,
        excerpt: true,
        highlightColor: true,
        locator: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { ...row, locator: parseLocator(row.locator, 'Annotation') };
  }

  async remove(input: DeleteInput): Promise<void> {
    const owned = await this.ownedLibraryItem(
      input.clerkUserId,
      input.libraryItemId,
    );

    // deleteMany swallows "not found" — that's exactly what we want for the
    // offline replay path, where a delete may be re-sent after the row is
    // already gone. The userId/libraryItemId match also prevents cross-user
    // deletion attempts from reporting success.
    await this.prisma.annotation.deleteMany({
      where: {
        id: input.id,
        userId: owned.userId,
        libraryItemId: owned.libraryItemId,
      },
    });
  }

  private ownedLibraryItem(clerkUserId: string, libraryItemId: string) {
    return requireOwnedLibraryItem({
      clerkUserId,
      libraryItemId,
      prisma: this.prisma,
      users: this.users,
    });
  }
}
