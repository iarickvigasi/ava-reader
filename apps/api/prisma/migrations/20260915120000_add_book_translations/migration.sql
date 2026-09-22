CREATE TABLE "BookTranslation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "contentRevision" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "translationVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SentenceTranslation" (
    "id" TEXT NOT NULL,
    "bookTranslationId" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "itemId" TEXT,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SentenceTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookTranslation_version_key" ON "BookTranslation"("userId", "libraryItemId", "contentRevision", "targetLang", "translationVersion");
CREATE INDEX "BookTranslation_userId_libraryItemId_idx" ON "BookTranslation"("userId", "libraryItemId");
CREATE UNIQUE INDEX "SentenceTranslation_bookTranslationId_sentenceId_key" ON "SentenceTranslation"("bookTranslationId", "sentenceId");
CREATE INDEX "SentenceTranslation_bookTranslationId_chapterId_idx" ON "SentenceTranslation"("bookTranslationId", "chapterId");
ALTER TABLE "BookTranslation" ADD CONSTRAINT "BookTranslation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookTranslation" ADD CONSTRAINT "BookTranslation_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SentenceTranslation" ADD CONSTRAINT "SentenceTranslation_bookTranslationId_fkey" FOREIGN KEY ("bookTranslationId") REFERENCES "BookTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
