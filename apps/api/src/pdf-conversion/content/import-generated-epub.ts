import { ContractError } from '../contracts/contract-error';
import { negotiateReader } from '../contracts/negotiate-reader';
import type { SemanticValidator } from '../contracts/types';
import { validateContract } from '../contracts/validate-contract';
import { conservationReport } from './conservation-report';
import type { ContentContext } from './prepare-reader-package';

// Explicit opt-in route only. Ordinary EPUB import keeps its existing parser.
export async function importGeneratedEpub(input: {
  epub: Buffer;
  context: ContentContext;
  reimport: (epub: Buffer, context: ContentContext) => Promise<Buffer>;
  semantic: SemanticValidator;
  client: Parameters<typeof negotiateReader>[1];
}) {
  const context = { ...input.context };
  const client = {
    versions: [...input.client.versions],
    capabilities: [...input.client.capabilities],
  };
  const bytes = await input.reimport(Buffer.from(input.epub), context);
  const reader = await validateContract('ava-reader-3', bytes, input.semantic);
  if (
    reader.final_content_id !== context.finalContentId ||
    reader.canonical_sha256 !== context.canonicalSha256 ||
    reader.book.source.sha256 !== context.sourceSha256
  ) {
    throw new ContractError('INVALID_CONTRACT');
  }
  return {
    negotiation: await negotiateReader(bytes, client, input.semantic),
    conservation: {
      ...conservationReport(reader),
      epubConservation: 'pass' as const,
    },
  };
}
