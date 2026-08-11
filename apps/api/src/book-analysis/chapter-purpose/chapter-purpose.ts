import { generateObject, type LanguageModel } from 'ai';
import type { ReaderPackage } from '../../reader/reader-types';
import { batchChapters } from './batch';
import { buildChapterDigests, type ChapterDigest } from './build-digest';
import { finalizeAnalysis, type Verdict } from './finalize-analysis';
import { buildChapterPurposePrompt } from './prompt';
import { chapterPurposeOutputSchema } from './schema';

export type {
  ChapterPurposeAnalysis,
  ChapterPurposeEntry,
} from './finalize-analysis';

// A request that opens a socket and never answers would otherwise hang
// `processRun` forever, and the poller's in-flight guard is only released in a
// `finally` — one dead request would silently stop every future analysis in
// this process. Generous enough that a 60-chapter batch never trips it.
const REQUEST_TIMEOUT_MS = 90_000;

export async function analyseChapterPurposes(input: {
  model: LanguageModel;
  readerPackage: ReaderPackage;
}) {
  const { manifest, chapters } = input.readerPackage;
  const digests = buildChapterDigests(chapters);
  const batches = batchChapters(digests);
  const verdicts = new Map<number, Verdict>();

  for (const batch of batches) {
    const results = await classifyBatch({
      allTitles: batches.length > 1 ? digests.map((d) => d.title) : undefined,
      authors: manifest.authors,
      batch,
      bookTitle: manifest.title,
      model: input.model,
      totalChapters: digests.length,
    });

    for (const [index, verdict] of results) {
      verdicts.set(index, verdict);
    }
  }

  return finalizeAnalysis(digests, verdicts);
}

async function classifyBatch(input: {
  allTitles?: string[];
  authors: string[];
  batch: ChapterDigest[];
  bookTitle: string;
  model: LanguageModel;
  totalChapters: number;
}): Promise<Map<number, Verdict>> {
  const { prompt, system } = buildChapterPurposePrompt({
    allTitles: input.allTitles,
    authors: input.authors,
    bookTitle: input.bookTitle,
    digests: input.batch,
    totalChapters: input.totalChapters,
  });

  const { object } = await generateObject({
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    model: input.model,
    prompt,
    schema: chapterPurposeOutputSchema,
    system,
    temperature: 0,
  });

  // Indices the model invented (or echoed from another batch) are dropped —
  // only chapters actually present in this batch are accepted.
  const allowed = new Set(input.batch.map((digest) => digest.index));

  return new Map(
    object.chapters
      .filter((entry) => allowed.has(entry.index))
      .map((entry) => [
        entry.index,
        { confidence: entry.confidence, purpose: entry.purpose },
      ]),
  );
}
