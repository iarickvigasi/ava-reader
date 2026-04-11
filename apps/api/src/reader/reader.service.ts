import { BookFileFormat, BookFileKind, ProcessingStatus } from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type {
  ReaderChapter,
  ReaderLocator,
  ReaderPackage,
  ReaderTocNode,
} from './reader-types';

type ReaderProgressSummary = {
  chapterLabel: string | null;
  completionPercent: number;
  lastReadAt: string | null;
  locator: ReaderLocator | null;
};

type ReaderReadyPayload = {
  activeChapterId: string;
  book: {
    author: string | null;
    libraryItemId: string;
    primaryFormat: BookFileFormat;
    title: string;
  };
  chapters: ReaderChapter[];
  progress: ReaderProgressSummary;
  status: 'READY';
  toc: ReaderTocNode[];
};

type ReaderStatusPayload =
  | ReaderReadyPayload
  | {
      book: {
        author: string | null;
        libraryItemId: string;
        primaryFormat: BookFileFormat;
        title: string;
      };
      message: string;
      progress: ReaderProgressSummary;
      status: 'FAILED' | 'PROCESSING' | 'UNSUPPORTED';
    };

@Injectable()
export class ReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getReaderPayload(
    clerkUserId: string,
    libraryItemId: string,
    chapterId?: string,
  ): Promise<ReaderStatusPayload> {
    const libraryItem = await this.getOwnedLibraryItem(
      clerkUserId,
      libraryItemId,
    );

    const sourceFile = libraryItem.book.files.find(
      (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
    );
    const progress = createProgressSummary(libraryItem.progress);

    if (!sourceFile || sourceFile.format !== BookFileFormat.EPUB) {
      return {
        book: {
          author: libraryItem.book.author,
          libraryItemId: libraryItem.id,
          primaryFormat: sourceFile?.format ?? BookFileFormat.UNKNOWN,
          title: libraryItem.book.title,
        },
        message: 'This reader currently supports EPUB books only.',
        progress,
        status: 'UNSUPPORTED',
      };
    }

    const derivedReader = libraryItem.book.files.find(
      (file) =>
        file.kind === BookFileKind.DERIVED_READER &&
        file.isPrimary &&
        file.processingStatus === ProcessingStatus.READY,
    );

    if (!derivedReader?.blob) {
      const latestRun = libraryItem.book.processingRuns[0] ?? null;

      if (latestRun?.status === ProcessingStatus.FAILED) {
        return {
          book: {
            author: libraryItem.book.author,
            libraryItemId: libraryItem.id,
            primaryFormat: sourceFile.format,
            title: libraryItem.book.title,
          },
          message:
            latestRun.errorMessage ??
            'The EPUB could not be prepared for the reader.',
          progress,
          status: 'FAILED',
        };
      }

      return {
        book: {
          author: libraryItem.book.author,
          libraryItemId: libraryItem.id,
          primaryFormat: sourceFile.format,
          title: libraryItem.book.title,
        },
        message: 'Preparing this EPUB for the reader.',
        progress,
        status: 'PROCESSING',
      };
    }

    const readerPackage = parseReaderPackage(
      Buffer.from(derivedReader.blob.bytes),
    );
    const selectedChapter =
      selectChapter(readerPackage, chapterId) ??
      selectChapter(readerPackage, progress.locator?.chapterId) ??
      readerPackage.chapters[0];

    if (!selectedChapter) {
      throw new BadRequestException(
        'The derived reader package has no chapters.',
      );
    }

    const chapterWindow = selectChapterWindow(
      readerPackage,
      selectedChapter.chapterId,
    );

    return {
      activeChapterId: selectedChapter.chapterId,
      book: {
        author: libraryItem.book.author,
        libraryItemId: libraryItem.id,
        primaryFormat: sourceFile.format,
        title: libraryItem.book.title,
      },
      chapters: chapterWindow,
      progress,
      status: 'READY',
      toc: readerPackage.toc,
    };
  }

  async updateProgress(
    clerkUserId: string,
    libraryItemId: string,
    locator: ReaderLocator,
  ): Promise<ReaderProgressSummary> {
    validateLocator(locator);

    const libraryItem = await this.getOwnedLibraryItem(
      clerkUserId,
      libraryItemId,
    );
    const derivedReader = libraryItem.book.files.find(
      (file) =>
        file.kind === BookFileKind.DERIVED_READER &&
        file.isPrimary &&
        file.processingStatus === ProcessingStatus.READY,
    );

    if (!derivedReader?.blob) {
      throw new BadRequestException('The reader package is not ready yet.');
    }

    const readerPackage = parseReaderPackage(
      Buffer.from(derivedReader.blob.bytes),
    );
    const metrics = computeProgressMetrics(readerPackage, locator);

    const progress = await this.prisma.readingProgress.update({
      where: {
        libraryItemId,
      },
      data: {
        chapterLabel: metrics.chapterLabel,
        completionPercent: metrics.completionPercent,
        currentLocator: JSON.stringify(locator),
        lastReadAt: new Date(),
      },
    });

    await this.prisma.libraryItem.update({
      where: {
        id: libraryItemId,
      },
      data: {
        lastOpenedAt: new Date(),
      },
    });

    return createProgressSummary(progress);
  }

  async markReaderOpened(clerkUserId: string, libraryItemId: string) {
    const libraryItem = await this.getOwnedLibraryItem(
      clerkUserId,
      libraryItemId,
    );

    await this.prisma.libraryItem.update({
      where: {
        id: libraryItem.id,
      },
      data: {
        lastOpenedAt: new Date(),
      },
    });
  }

  private async getOwnedLibraryItem(
    clerkUserId: string,
    libraryItemId: string,
  ) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const libraryItem = await this.prisma.libraryItem.findFirst({
      where: {
        id: libraryItemId,
        userId: user.id,
      },
      include: {
        book: {
          include: {
            files: {
              include: {
                blob: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            processingRuns: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
        progress: true,
      },
    });

    if (!libraryItem) {
      throw new NotFoundException('The requested library item was not found.');
    }

    return libraryItem;
  }
}

function parseReaderPackage(buffer: Buffer): ReaderPackage {
  const raw = JSON.parse(buffer.toString('utf8')) as unknown;
  const candidate =
    raw && typeof raw === 'object'
      ? (raw as { chapters?: unknown; version?: unknown })
      : null;

  if (
    !candidate ||
    (candidate.version !== 1 && candidate.version !== 2) ||
    !Array.isArray(candidate.chapters)
  ) {
    throw new BadRequestException('The stored reader package is invalid.');
  }

  if (candidate.version === 1) {
    return normalizeLegacyReaderPackage(raw as LegacyReaderPackage);
  }

  return raw as ReaderPackage;
}

function selectChapter(
  readerPackage: ReaderPackage,
  chapterId?: string | null,
) {
  if (!chapterId) {
    return null;
  }

  return (
    readerPackage.chapters.find((chapter) => chapter.chapterId === chapterId) ??
    null
  );
}

function selectChapterWindow(
  readerPackage: ReaderPackage,
  activeChapterId: string,
) {
  const activeIndex = readerPackage.chapters.findIndex(
    (chapter) => chapter.chapterId === activeChapterId,
  );

  if (activeIndex === -1) {
    return [];
  }

  const windowStart = Math.max(0, activeIndex - 1);
  const windowEnd = Math.min(readerPackage.chapters.length, activeIndex + 2);

  return readerPackage.chapters.slice(windowStart, windowEnd);
}

function createProgressSummary(
  progress: {
    chapterLabel: string | null;
    completionPercent: number;
    currentLocator: string | null;
    lastReadAt: Date | null;
  } | null,
): ReaderProgressSummary {
  return {
    chapterLabel: progress?.chapterLabel ?? null,
    completionPercent: progress?.completionPercent ?? 0,
    lastReadAt: progress?.lastReadAt?.toISOString() ?? null,
    locator: parseLocator(progress?.currentLocator ?? null),
  };
}

function parseLocator(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ReaderLocator>;

    if (
      typeof parsed.chapterId !== 'string' ||
      typeof parsed.blockId !== 'string' ||
      typeof parsed.textOffset !== 'number'
    ) {
      return null;
    }

    return {
      blockId: parsed.blockId,
      chapterId: parsed.chapterId,
      textOffset: parsed.textOffset,
    };
  } catch {
    return null;
  }
}

function validateLocator(locator: ReaderLocator) {
  if (!locator || Number.isNaN(locator.textOffset) || locator.textOffset < 0) {
    throw new BadRequestException('A valid reader locator is required.');
  }
}

function computeProgressMetrics(
  readerPackage: ReaderPackage,
  locator: ReaderLocator,
) {
  const chapterIndex = readerPackage.chapters.findIndex(
    (chapter) => chapter.chapterId === locator.chapterId,
  );

  if (chapterIndex === -1) {
    throw new BadRequestException('The requested chapter does not exist.');
  }

  const chapter = readerPackage.chapters[chapterIndex];
  const blockIndex = chapter.blocks.findIndex(
    (block) => block.id === locator.blockId,
  );

  if (blockIndex === -1) {
    throw new BadRequestException('The requested block does not exist.');
  }

  const blocksBeforeChapter = readerPackage.chapters
    .slice(0, chapterIndex)
    .reduce((sum, currentChapter) => sum + currentChapter.blocks.length, 0);
  const absoluteBlockIndex = blocksBeforeChapter + blockIndex + 1;
  const completionPercent =
    readerPackage.manifest.totalBlocks > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (absoluteBlockIndex / readerPackage.manifest.totalBlocks) * 100,
            ),
          ),
        )
      : 0;

  return {
    chapterLabel:
      findBestTocLabel(readerPackage.toc, locator) ??
      chapter.title ??
      chapter.label,
    completionPercent,
  };
}

type LegacyReaderTocEntry = {
  chapterId: string;
  href: string;
  label: string;
  spineIndex: number;
};

type LegacyReaderPackage = Omit<ReaderPackage, 'toc' | 'version'> & {
  toc: LegacyReaderTocEntry[];
  version: 1;
};

function normalizeLegacyReaderPackage(
  readerPackage: LegacyReaderPackage,
): ReaderPackage {
  return {
    ...readerPackage,
    toc: readerPackage.toc.map((entry, index) => ({
      anchorId: null,
      blockId: null,
      chapterId: entry.chapterId,
      children: [],
      href: entry.href,
      id: `toc:${index}`,
      label: entry.label,
      spineIndex: entry.spineIndex,
    })),
    version: 2,
  };
}

function findBestTocLabel(
  toc: ReaderTocNode[],
  locator: ReaderLocator,
): string | null {
  const exactMatch = findDeepestTocMatch(
    toc,
    (node) =>
      node.chapterId === locator.chapterId && node.blockId === locator.blockId,
  );

  if (exactMatch?.label) {
    return exactMatch.label;
  }

  return (
    findFirstTocMatch(toc, (node) => node.chapterId === locator.chapterId)
      ?.label ?? null
  );
}

function findDeepestTocMatch(
  toc: ReaderTocNode[],
  predicate: (node: ReaderTocNode) => boolean,
  depth = 0,
): { depth: number; label: string } | null {
  let bestMatch: { depth: number; label: string } | null = null;

  for (const node of toc) {
    if (predicate(node) && node.label) {
      bestMatch = { depth, label: node.label };
    }

    const nestedMatch = findDeepestTocMatch(
      node.children,
      predicate,
      depth + 1,
    );
    if (nestedMatch && (!bestMatch || nestedMatch.depth >= bestMatch.depth)) {
      bestMatch = nestedMatch;
    }
  }

  return bestMatch;
}

function findFirstTocMatch(
  toc: ReaderTocNode[],
  predicate: (node: ReaderTocNode) => boolean,
): ReaderTocNode | null {
  for (const node of toc) {
    if (predicate(node)) {
      return node;
    }

    const nestedMatch = findFirstTocMatch(node.children, predicate);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}
