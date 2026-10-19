import type { PrismaService } from '../../../prisma/prisma.service';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import { selectAcceptedPdfReader } from './select-accepted-reader';
import { publishedPdfAuthority } from './published-authority';
export async function loadAcceptedPdfReader(
  prisma: PrismaService,
  input: {
    ownerId: string;
    libraryItemId: string;
    schema: string;
    build: string;
  },
  semantic: SemanticValidator,
) {
  const initial = await prisma.pdfImportOperation.findFirst({
    where: { ownerId: input.ownerId, libraryItemId: input.libraryItemId },
  });
  if (!initial) return null;
  const {
    op,
    publication,
    qualification: q,
  } = await publishedPdfAuthority(
    prisma,
    input.ownerId,
    initial.id,
    input.schema,
    input.build,
  );
  const selected = await selectAcceptedPdfReader({
    acceptedBytes: Buffer.from(publication.acceptedBytes),
    semantic,
    authority: {
      viewer: { ownerId: input.ownerId, libraryItemId: input.libraryItemId },
      operation: op,
      publication: {
        acceptedSha256: publication.acceptedSha256,
        fence: publication.publicationFence,
      },
      capability: {
        qualified: true,
        adapterFingerprint: q.adapterFingerprint,
        readerBuildFingerprint: q.readerBuildFingerprint,
        reportSha256: q.reportSha256,
        versions: [3],
        capabilities: q.capabilities,
      },
    },
    loadOwnedArtifact: async (id) => {
      const a = await prisma.pdfArtifact.findFirst({
        where: { id, ownerId: input.ownerId, operationId: op.id },
        include: { blob: true },
      });
      return a && a.operationId
        ? { ...a, operationId: a.operationId, bytes: a.blob.bytes }
        : null;
    },
  });
  // Deletion during semantic validation must not return newly readable bytes.
  await publishedPdfAuthority(
    prisma,
    input.ownerId,
    op.id,
    input.schema,
    input.build,
  );
  const resourceUrls = Object.fromEntries(
    selected.reader.book.resources.map((r) => [
      r.id,
      `/api/library/pdf-imports/${encodeURIComponent(op.id)}/resources/${encodeURIComponent(r.id)}`,
    ]),
  );
  return {
    readerPackage: selected.reader,
    resourceUrls,
    publication,
    operation: op,
  };
}
