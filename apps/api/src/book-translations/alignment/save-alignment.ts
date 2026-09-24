import type { PrismaService } from '../../prisma/prisma.service';
import type { AlignmentInput } from './alignment-input';
import {
  AlignmentValidationError,
  type AlignmentOutput,
} from './alignment-output';
import { resolveAlignment } from './resolve-alignment';

export async function saveAlignment(
  prisma: PrismaService,
  row: AlignmentInput,
  outputs: AlignmentOutput[],
  signal: AbortSignal,
) {
  const matches = outputs.filter((output) => output.id === row.sentenceId);
  if (matches.length !== 1)
    throw new AlignmentValidationError(
      matches.length ? 'Duplicate sentence ID.' : 'Missing alignment sentence.',
    );
  const alignment = resolveAlignment(
    matches[0],
    row.sourceText,
    row.translatedText,
    row.source,
    row.translation,
  );
  signal.throwIfAborted();
  // Save each valid sentence against the exact winning translation.
  const saved = await prisma.sentenceTranslation.updateMany({
    where: {
      id: row.id,
      sourceText: row.sourceText,
      translatedText: row.translatedText,
    },
    data: { alignment },
  });
  return saved.count > 0;
}
