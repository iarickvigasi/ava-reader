import { BookFileKind } from '@prisma/client';

type BookFileLike = {
  isPrimary: boolean;
  kind: BookFileKind;
};

// A processed book carries two primary files — the SOURCE upload and the
// current DERIVED_READER package (processing demotes only old derived
// primaries). Listings mean the source, so prefer it; fall back to any
// primary for books that predate the kind split.
export function findPrimarySourceFile<File extends BookFileLike>(
  files: File[],
): File | null {
  return (
    files.find((file) => file.kind === BookFileKind.SOURCE && file.isPrimary) ??
    files.find((file) => file.isPrimary) ??
    null
  );
}
