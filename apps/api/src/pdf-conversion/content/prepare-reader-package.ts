import { ContractError } from '../contracts/contract-error';
import type { SemanticValidator } from '../contracts/types';
import { validateContract } from '../contracts/validate-contract';
import { conservationReport } from './conservation-report';
import { requiredCapabilities } from './required-capabilities';
import { chapterCounting } from './chapter-counting';

export type ContentContext = {
  finalContentId: string;
  canonicalSha256: string;
  sourceSha256: string;
};

// The digest is authored by Python ava-json-v1, never by Node JSON.stringify.
// This constructs a candidate. It grants no publication or renderer authority.
export async function prepareReaderPackage(input: {
  canonical: Buffer;
  context: ContentContext;
  semantic: SemanticValidator;
}) {
  const context = { ...input.context };
  const book = await validateContract(
    'ava-book-2',
    input.canonical,
    input.semantic,
  );
  if (book.source.sha256 !== context.sourceSha256) {
    throw new ContractError('INVALID_CONTRACT');
  }
  const bytes = Buffer.from(
    JSON.stringify({
      schema_version: 'ava-reader-3',
      version: 3,
      final_content_id: context.finalContentId,
      canonical_hash_algorithm: 'ava-json-v1',
      canonical_sha256: context.canonicalSha256,
      required_capabilities: requiredCapabilities(book),
      book,
    }),
  );
  const reader = await validateContract('ava-reader-3', bytes, input.semantic);
  return {
    reader,
    bytes,
    conservation: conservationReport(reader),
    counting: chapterCounting(book),
  };
}
