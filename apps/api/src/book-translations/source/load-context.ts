import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import {
  findReadyDerivedReader,
  getOwnedLibraryItem,
} from '../../reader/library-item-access';
import { loadReaderPackage } from '../../reader/package/load-reader-package';
import { buildSentenceCatalog } from './sentence-catalog';
import { TRANSLATION_VERSION, type TranslationContext } from '../types';

export async function loadTranslationContext(args: {
  prisma: PrismaService;
  users: UsersService;
  clerkUserId: string;
  libraryItemId: string;
  chapterId: string;
  targetLang: string;
}): Promise<TranslationContext> {
  const owned = await getOwnedLibraryItem(
    args.prisma,
    args.users,
    args.clerkUserId,
    args.libraryItemId,
  );
  const file = findReadyDerivedReader(owned);
  if (!file) throw new ConflictException('The reader package is not ready.');
  const readerPackage = await loadReaderPackage(args.prisma, file.blobId);
  const chapter = readerPackage.chapters.find(
    (item) => item.chapterId === args.chapterId,
  );
  if (!chapter)
    throw new NotFoundException('The requested chapter was not found.');
  return {
    libraryItemId: owned.id,
    userId: owned.userId,
    chapterId: chapter.chapterId,
    contentRevision: file.id,
    translationVersion: TRANSLATION_VERSION,
    targetLang: args.targetLang.trim(),
    title: owned.book.title,
    authors: owned.book.authors,
    sourceLanguage: owned.book.language,
    units: buildSentenceCatalog(chapter, file.id, owned.book.language),
  };
}
