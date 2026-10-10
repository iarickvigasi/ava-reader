import { ConflictException } from '@nestjs/common';
import type { EpubAuthorityStore } from '../../library/epub-import/authority';
import { importedEpubAuthority } from '../../library/epub-import/authority';
import { publishedPdfAuthority } from '../../library/pdf-import/reader/published-authority';
import type { AcceptedReader } from './load';
import type { ReaderCapability } from './semantic';
export type CanonicalContentAuthority = { finalContentId: string } & (
  | { kind?: 'pdf-import'; operationId: string; publicationId: string }
  | {
      kind: 'epub-import';
      importId: string;
      sourceSha256: string;
      readerSha256: string;
    }
);
export function canonicalContentAuthority(
  accepted: AcceptedReader,
): CanonicalContentAuthority {
  const finalContentId = accepted.readerPackage.final_content_id;
  return accepted.kind === 'epub-import'
    ? {
        kind: 'epub-import',
        finalContentId,
        importId: accepted.importRecord.id,
        sourceSha256: accepted.importRecord.sourceSha256,
        readerSha256: accepted.importRecord.readerSha256,
      }
    : {
        kind: 'pdf-import',
        finalContentId,
        operationId: accepted.operation.id,
        publicationId: accepted.publication.id,
      };
}
export async function assertCanonicalContentAuthority(
  tx: EpubAuthorityStore,
  ownerId: string,
  libraryItemId: string,
  authority: CanonicalContentAuthority,
  capability: ReaderCapability,
) {
  if (authority.kind === 'epub-import') {
    const { record } = await importedEpubAuthority(
      tx,
      ownerId,
      authority.importId,
      capability.schema,
      capability.build,
    );
    if (
      record.libraryItemId !== libraryItemId ||
      record.finalContentId !== authority.finalContentId ||
      record.sourceSha256 !== authority.sourceSha256 ||
      record.readerSha256 !== authority.readerSha256
    )
      throw new ConflictException('Accepted content changed.');
  } else {
    const { op, publication } = await publishedPdfAuthority(
      tx,
      ownerId,
      authority.operationId,
      capability.schema,
      capability.build,
    );
    if (
      op.libraryItemId !== libraryItemId ||
      op.finalContentId !== authority.finalContentId ||
      publication.id !== authority.publicationId
    )
      throw new ConflictException('Accepted content changed.');
  }
}
