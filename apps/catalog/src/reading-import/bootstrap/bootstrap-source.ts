import { createHash } from 'node:crypto';
import type { BootstrapBook } from './read-bootstrap';
import { providerReference } from '../providers/provider-reference';
export function bootstrapSource(book: BootstrapBook) {
  const source = providerReference(book);
  const digital = source.provider !== 'internet-archive';
  const identity = digital
    ? {
        provider: source.provider,
        providerId: source.id,
        sourceUrl: source.sourceUrl,
      }
    : {};
  const payload = {
    title: book.title,
    author: book.author,
    language: book.language,
    ...(digital ? identity : { ocaid: source.id }),
  };
  const key = digital
    ? `${source.provider}:${createHash('sha256').update(source.id).digest('hex')}`
    : source.id;
  return {
    payload,
    identity,
    sourceUrl: source.sourceUrl,
    externalId: `curated:${key}:${book.language}`,
    payloadHash: createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex'),
  };
}
