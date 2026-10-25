import { BookFileFormat, BookFileKind } from '@prisma/client';

export function hasReadableEdition(
  files: { kind: BookFileKind; format: BookFileFormat }[],
): boolean {
  return files.some(
    (file) =>
      file.kind === BookFileKind.DERIVED_READER ||
      (file.kind === BookFileKind.SOURCE &&
        (file.format === BookFileFormat.EPUB ||
          file.format === BookFileFormat.PDF)),
  );
}
