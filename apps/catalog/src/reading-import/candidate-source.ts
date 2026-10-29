import { SOURCE_KEY } from '../importer/types';
import type { Candidate } from './types';
export const CURATED_SOURCE = 'curated-classics';
export function candidateSource(
  candidate: Pick<Candidate, 'sourceKey' | 'externalId'>,
) {
  const source = candidate.sourceKey ?? SOURCE_KEY;
  const valid =
    source === SOURCE_KEY
      ? /^\/books\/OL\d+M$/.test(candidate.externalId)
      : source === CURATED_SOURCE &&
        /^curated:(?:(?:standard-ebooks|wolne-lektury):[a-f\d]{64}|[A-Za-z0-9._-]{1,200}):[a-z]{2,3}$/.test(
          candidate.externalId,
        );
  if (!valid) throw new Error('Unsupported candidate source identity');
  return source;
}
