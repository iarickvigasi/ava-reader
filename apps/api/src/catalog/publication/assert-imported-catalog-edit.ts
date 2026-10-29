import { BadRequestException } from '@nestjs/common';
export function assertImportedCatalogEdit(
  entry: { importKey: string | null },
  body: Record<string, unknown>,
  files: { sourceFile?: unknown[]; coverImage?: unknown[] },
) {
  if (
    entry.importKey &&
    (Object.keys(body).some((key) => key !== 'status') ||
      files.sourceFile?.length ||
      files.coverImage?.length)
  )
    throw new BadRequestException(
      'Edit imported descriptions in Explore. Changed files require a new reading import.',
    );
}
