import type { PrismaService } from '../../prisma/prisma.service';
import type { BilingualUnit, TranslationContext } from '../types';
import { translationVersionIdentity } from '../version-identity';

export async function persistTranslations(args: {
  prisma: PrismaService;
  context: TranslationContext;
  sentences: BilingualUnit[];
  translations: Record<string, string>;
  modelId: string;
}): Promise<void> {
  await args.prisma.$transaction(async (tx) => {
    const identity = translationVersionIdentity(args.context);
    const version = await tx.bookTranslation.upsert({
      where: { versionIdentity: identity },
      create: identity,
      update: { updatedAt: new Date() },
      select: { id: true },
    });
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
