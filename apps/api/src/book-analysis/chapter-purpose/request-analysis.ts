import { BookAnalysisKind, ProcessingStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export const CHAPTER_PURPOSE_PIPELINE = 'chapter-purpose-v1';

// Without a cap, a book the model can never classify would re-enqueue on every
// single open and burn credits forever. The counter lives on the analysis row
// beside the reader file id, so a re-imported book earns a fresh set of tries.
const MAX_ANALYSIS_ATTEMPTS = 3;

// Comfortably longer than a request can take (the AI call itself is capped at
// 90s), so this only ever catches runs abandoned by a crashed process.
const STALE_RUN_MS = 10 * 60 * 1_000;

/**
 * Enqueues a chapter-purpose run when the book needs one. Called on the read
 * path, so it must be cheap and must never throw into the reader payload:
 * analysis is a refinement, and a book has to open regardless.
 */
export async function requestChapterPurposeAnalysis(input: {
  bookId: string;
  prisma: PrismaService;
  readerFileId: string;
}): Promise<void> {
  const { bookId, prisma, readerFileId } = input;

  const analysis = await prisma.bookAnalysis.findUnique({
    where: { bookId_kind: { bookId, kind: BookAnalysisKind.CHAPTER_PURPOSE } },
    select: { attempts: true, readerFileId: true, status: true },
  });

  // A result for a different reader file is stale, not fresh — reprocessing
  // shifted the chapter ids, so it has to be redone.
  if (analysis?.readerFileId === readerFileId) {
    if (analysis.status === ProcessingStatus.READY) {
      return;
    }

    if (analysis.attempts >= MAX_ANALYSIS_ATTEMPTS) {
      return;
    }
  }

  const active = await prisma.bookProcessingRun.findFirst({
    where: {
      bookId,
      pipeline: CHAPTER_PURPOSE_PIPELINE,
      OR: [
        { status: ProcessingStatus.PENDING },
        // A PROCESSING row only blocks while it could plausibly still be
        // running. If the process died mid-run nothing would ever close the
        // row, and without this window that book could never be analysed
        // again. `updatedAt` is stamped when the run is claimed.
        {
          status: ProcessingStatus.PROCESSING,
          updatedAt: { gte: new Date(Date.now() - STALE_RUN_MS) },
        },
      ],
    },
    select: { id: true },
  });

  if (active) {
    return;
  }

  await prisma.bookProcessingRun.create({
    data: { bookId, pipeline: CHAPTER_PURPOSE_PIPELINE },
  });
}
