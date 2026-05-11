import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

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
    const user = await this.users.getCurrentUserRecord(clerkUserId);
    const libraryItem = await this.prisma.libraryItem.findFirst({
      where: { id: libraryItemId, userId: user.id },
      select: { id: true },
    });
    if (!libraryItem) {
      throw new NotFoundException('Library item not found.');
    }

    const rows = await this.prisma.annotation.findMany({
      where: { userId: user.id, libraryItemId: libraryItem.id },
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
      locator: parseLocator(row.locator),
    }));
  }

  // Idempotent create-or-update keyed by client-generated id. The offline
  // queue may replay the same write after the server already persisted it, so
  // we can't 409 on conflict. We do verify ownership: if the row exists but
  // belongs to another user (i.e. id collision across accounts), we treat it
  // as a fresh row and 404 on update so the queue stops retrying.
  async upsert(input: UpsertInput): Promise<AnnotationListItem> {
    const user = await this.users.getCurrentUserRecord(input.clerkUserId);
    const libraryItem = await this.prisma.libraryItem.findFirst({
      where: { id: input.libraryItemId, userId: user.id },
      select: { id: true },
    });
    if (!libraryItem) {
      throw new NotFoundException('Library item not found.');
    }

    const existing = await this.prisma.annotation.findUnique({
      where: { id: input.id },
      select: { userId: true, libraryItemId: true },
    });
    if (
      existing &&
      (existing.userId !== user.id || existing.libraryItemId !== libraryItem.id)
    ) {
      throw new NotFoundException('Annotation not found.');
    }

    const row = await this.prisma.annotation.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        userId: user.id,
        libraryItemId: libraryItem.id,
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

    return { ...row, locator: parseLocator(row.locator) };
  }

  async remove(input: DeleteInput): Promise<void> {
    const user = await this.users.getCurrentUserRecord(input.clerkUserId);
    const libraryItem = await this.prisma.libraryItem.findFirst({
      where: { id: input.libraryItemId, userId: user.id },
      select: { id: true },
    });
    if (!libraryItem) {
      throw new NotFoundException('Library item not found.');
    }

    // deleteMany swallows "not found" — that's exactly what we want for the
    // offline replay path, where a delete may be re-sent after the row is
    // already gone. The userId/libraryItemId match also prevents cross-user
    // deletion attempts from reporting success.
    await this.prisma.annotation.deleteMany({
      where: {
        id: input.id,
        userId: user.id,
        libraryItemId: libraryItem.id,
      },
    });
  }
}

const parseLocatorLogger = new Logger('parseAnnotationLocator');

function parseLocator(raw: string | null): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    parseLocatorLogger.error(`Annotation locator JSON was not parsed: ${raw}`);
    return null;
  }
}
