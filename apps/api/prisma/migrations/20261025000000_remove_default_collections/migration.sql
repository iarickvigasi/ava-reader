-- CollectionItem cascades; LibraryItem and all book-owned data remain intact.
-- Match system identity, never display names (CUSTOM namesakes must survive).
DELETE FROM "Collection"
WHERE "kind" = 'SMART'
  AND "smartKey" IN ('imported-library', 'public-domain-library', 'offline-books');
