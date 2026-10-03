import type {
  ReaderPackageV3,
  TextValue,
} from '../contracts/generated/ava-reader-3';
import type { ValidatedContract } from '../contracts/types';

export function conservationReport(reader: ValidatedContract<ReaderPackageV3>) {
  const { book } = reader;
  const text = book.blocks.flatMap<{ content: TextValue }>((block) =>
    block.kind === 'table' ? block.cells : 'content' in block ? [block] : [],
  );
  return {
    adapter: 'ava-canonical-reader-1' as const,
    finalContentId: reader.final_content_id,
    canonicalSha256: reader.canonical_sha256,
    sourceSha256: book.source.sha256,
    canonicalToReader: 'pass' as const,
    sourceAccuracy: 'not_run' as const,
    epubConservation: 'not_run' as const,
    actualReader: 'not_run' as const,
    publicationEligible: false as const,
    counts: {
      chapters: book.spine.length,
      blocks: book.blocks.length,
      textSegments: text.length,
      codepoints: text.reduce((n, b) => n + [...b.content.text].length, 0),
      addresses: book.addresses.length,
      resources: book.resources.length,
    },
    noteBodyTreatment:
      'one canonical block per note; labels and returns are separate' as const,
    requiredCapabilities: [...reader.required_capabilities],
  };
}
