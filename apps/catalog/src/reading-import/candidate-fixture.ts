import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Candidate } from './types';

export async function candidateFixture(
  directory: string,
): Promise<{ candidate: Candidate; bytes: Buffer }> {
  const bytes = Buffer.from('reviewed EPUB bytes');
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const localFile = join(directory, 'book.epub');
  await writeFile(localFile, bytes);
  const candidate: Candidate = {
    editionId: 'edition',
    workId: 'work',
    externalId: '/books/OL1M',
    sourceRevision: '1',
    sourcePayloadHash: 'a'.repeat(64),
    title: 'Classic',
    authors: ['Author'],
    language: 'en',
    iaIdentifier: 'classic',
    filename: 'classic.epub',
    localFile,
    checksum,
    review: {
      sha256: checksum,
      reviewer: 'Reviewer',
      rightsStatement: 'Approved exact edition',
      rightsUrl: 'https://archive.org/details/classic',
      rightsJurisdiction: 'US',
      reviewedAt: '2026-01-01T00:00:00Z',
      qualityReviewedAt: '2026-01-01T00:00:00Z',
      notes: 'Reviewed samples',
    },
  };
  return { candidate, bytes };
}
