import { countsTowardReading } from '../../book-analysis/chapter-purpose/policy';
import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';

export function chapterCounting(book: CanonicalBookV2) {
  return book.chapters.map((chapter) => ({
    chapterId: chapter.id,
    sourceRole: chapter.role,
    // Front/back matter is broader than the existing detailed purpose taxonomy.
    // Preserve that evidence without inventing a purpose or paying a model to guess.
    counted: countsTowardReading({
      purpose: chapter.role === 'bodymatter' ? 'BODY' : 'UNKNOWN',
      confidence: chapter.role === 'bodymatter' ? 'high' : 'low',
    }),
  }));
}
