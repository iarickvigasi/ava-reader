import type { PrismaService } from '../../prisma/prisma.service';
import type { TranslationContext } from '../types';
import { translationVersionIdentity } from '../version-identity';

export async function readTranslations(args: {
  prisma: PrismaService;
  context: TranslationContext;
  sentenceIds?: string[];
}): Promise<Record<string, string>> {
  const allowed = new Set(
    args.sentenceIds ??
      args.context.units
        .filter((unit) => unit.kind === 'sentence')
        .map((unit) => unit.id),
  );
  const version = await args.prisma.bookTranslation.findUnique({
    where: { versionIdentity: translationVersionIdentity(args.context) },
    select: {
      sentences: {
        where: {
          chapterId: args.context.chapterId,
          ...(args.sentenceIds ? { sentenceId: { in: args.sentenceIds } } : {}),
        },
        select: { sentenceId: true, translatedText: true },
      },
    },
  });
  return Object.fromEntries(
    (version?.sentences ?? [])
      .filter((sentence) => allowed.has(sentence.sentenceId))
      .map((sentence) => [sentence.sentenceId, sentence.translatedText]),
  );
}
