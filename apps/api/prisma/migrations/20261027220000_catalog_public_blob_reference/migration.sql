ALTER TABLE "StoredBlob" ADD COLUMN "catalogBlobId" TEXT;
ALTER TABLE "StoredBlob" ADD CONSTRAINT "StoredBlob_external_has_no_bytes"
CHECK ("catalogBlobId" IS NULL OR octet_length(bytes) = 0);
