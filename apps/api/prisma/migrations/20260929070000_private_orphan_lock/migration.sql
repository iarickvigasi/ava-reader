-- Serialize concurrent final memberships before deciding that a private Book is orphaned.
CREATE OR REPLACE FUNCTION "markPrivateBookOrphan"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM 1 FROM "Book" WHERE id=OLD."bookId" FOR UPDATE;
  UPDATE "Book" b SET "privateOrphanedAt"=COALESCE("privateOrphanedAt",clock_timestamp())
   WHERE b.id=OLD."bookId" AND (b."pdfImportPrivate" OR b."canonicalImportPrivate")
   AND NOT EXISTS(SELECT 1 FROM "LibraryItem" i WHERE i."bookId"=b.id AND i.id<>OLD.id);
  RETURN OLD;
 END IF;
 UPDATE "Book" SET "privateOrphanedAt"=NULL WHERE id=NEW."bookId" AND "privateOrphanedAt" IS NOT NULL;
 RETURN NEW;
END $$;
