import type { ChapterDigest } from './build-digest';
import { countsTowardReading, tripsAggregateGuard } from './policy';
import {
  CHAPTER_PURPOSE_SCHEMA_VERSION,
  type ChapterConfidence,
  type ChapterPurpose,
} from './schema';

export type Verdict = {
  confidence: ChapterConfidence;
  purpose: ChapterPurpose;
};

export type ChapterPurposeEntry = {
  chapterId: string;
  confidence: ChapterConfidence;
  counted: boolean;
  purpose: ChapterPurpose;
};

export type ChapterPurposeAnalysis = {
  chapters: ChapterPurposeEntry[];
  lowConfidence: boolean;
  version: number;
};

// A chapter the model skipped is treated as readable text — the safe default,
// since body is the common case and over-counting lands on the old behaviour.
const MISSING_VERDICT: Verdict = { confidence: 'low', purpose: 'BODY' };

export function finalizeAnalysis(
  digests: ChapterDigest[],
  verdicts: Map<number, Verdict>,
): ChapterPurposeAnalysis {
  const scored = digests.map((digest) => {
    const verdict = verdicts.get(digest.index) ?? MISSING_VERDICT;

    return {
      chapterId: digest.chapterId,
      confidence: verdict.confidence,
      counted: countsTowardReading(verdict),
      purpose: verdict.purpose,
      wordCount: digest.wordCount,
    };
  });

  // When the aggregate guard trips the labelling is not trustworthy enough to
  // subtract anything, so everything counts and the whole book reverts to the
  // pre-analysis estimate.
  const lowConfidence = tripsAggregateGuard(scored);

  return {
    chapters: scored.map((entry) => ({
      chapterId: entry.chapterId,
      confidence: entry.confidence,
      counted: lowConfidence || entry.counted,
      purpose: entry.purpose,
    })),
    lowConfidence,
    version: CHAPTER_PURPOSE_SCHEMA_VERSION,
  };
}
