import type { PrismaService } from '../../prisma/prisma.service';
import type { SentenceAlignment, TranslationContext } from '../types';
import { translationVersionIdentity } from '../version-identity';

export type AlignmentReadArgs = {
  prisma: PrismaService;
  context: TranslationContext;
  sentenceIds?: string[];
};

export async function rowsFor(args: AlignmentReadArgs) {
  const version = await args.prisma.bookTranslation.findUnique({
    where: { versionIdentity: translationVersionIdentity(args.context) },
    select: {
      sentences: {
        where: {
          chapterId: args.context.chapterId,
          ...(args.sentenceIds ? { sentenceId: { in: args.sentenceIds } } : {}),
        },
        select: {
          id: true,
          sentenceId: true,
          sourceText: true,
          translatedText: true,
          alignment: true,
        },
      },
    },
  });
  return version?.sentences ?? [];
}

export function currentAlignment(
  row: Awaited<ReturnType<typeof rowsFor>>[number],
): SentenceAlignment | null {
  const value = row.alignment as SentenceAlignment | null;
  return value?.version === 3 &&
    value.sourceText === row.sourceText &&
    value.translatedText === row.translatedText
    ? value
    : null;
}

export async function readAlignments(
  args: AlignmentReadArgs,
): Promise<Record<string, SentenceAlignment>> {
  const allowed = new Map(
    args.context.units.map((unit) => [unit.id, unit.text]),
  );
  return Object.fromEntries(
    (await rowsFor(args)).flatMap((row) => {
      const alignment = currentAlignment(row);
      return alignment && allowed.get(row.sentenceId) === row.sourceText
        ? [[row.sentenceId, alignment]]
        : [];
    }),
  );
}
