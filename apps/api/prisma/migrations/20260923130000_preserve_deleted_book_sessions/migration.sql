-- Historical reading activity belongs to the user, independent of book lifetime.
ALTER TABLE "ReadingSession" DROP CONSTRAINT "ReadingSession_libraryItemId_fkey";
ALTER TABLE "ReadingSessionParticipant" DROP CONSTRAINT "ReadingSessionParticipant_libraryItemId_fkey";
ALTER TABLE "ReadingSessionSegment" DROP CONSTRAINT "ReadingSessionSegment_libraryItemId_fkey";
CREATE TABLE "DeletedLibraryItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeletedLibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DeletedLibraryItem_userId_idx" ON "DeletedLibraryItem"("userId");
