import type { PrismaService } from '../../prisma/prisma.service';
import type { BilingualUnit, TranslationContext } from '../types';
import { translationVersionIdentity } from '../version-identity';

export async function persistTranslations(args: {
  prisma: PrismaService;
  context: TranslationContext;
  sentences: BilingualUnit[];
  translations: Record<string, string>;
  modelId: string;
  regenerate?: boolean;
}): Promise<void> {
  await args.prisma.$transaction(async (tx) => {
    const identity = translationVersionIdentity(args.context);
    const version = await tx.bookTranslation.upsert({
      where: { versionIdentity: identity },
      create: identity,
      update: { updatedAt: new Date() },
      select: { id: true },
    });
    if (args.regenerate) {
      // Replace only the requested sentences, atomically after generation succeeds.
      // Removing their previous rows also invalidates pairs even if text is unchanged.
      await tx.sentenceTranslation.deleteMany({
        where: {
          bookTranslationId: version.id,
          chapterId: args.context.chapterId,
          sentenceId: { in: args.sentences.map((sentence) => sentence.id) },
        },
      });
    }
    await tx.sentenceTranslation.createMany({
      skipDuplicates: true,
      data: args.sentences.map((sentence) => ({
        bookTranslationId: version.id,
        sentenceId: sentence.id,
        chapterId: args.context.chapterId,
        blockId: sentence.blockId,
        itemId: sentence.itemId ?? null,
        startOffset: sentence.startOffset,
        endOffset: sentence.endOffset,
        sourceText: sentence.text,
        translatedText: args.translations[sentence.id],
        modelId: args.modelId,
      })),
    });
  });
}
