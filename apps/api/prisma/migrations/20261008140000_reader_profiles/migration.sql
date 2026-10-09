ALTER TABLE "User"
  ADD COLUMN "introduction" TEXT,
  ADD COLUMN "profilePublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shareCurrentBook" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD CONSTRAINT "User_introduction_length"
  CHECK ("introduction" IS NULL OR char_length("introduction") <= 180);
ALTER TABLE "User" ADD CONSTRAINT "User_published_introduction"
  CHECK (NOT "profilePublished" OR
    ("introduction" IS NOT NULL AND char_length(btrim("introduction")) > 0));
