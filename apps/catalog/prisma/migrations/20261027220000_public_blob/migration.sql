CREATE TABLE "PublicBlob" (
  id UUID PRIMARY KEY,
  purpose TEXT NOT NULL, checksum TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  bytes BYTEA NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicBlob_size" CHECK ("sizeBytes" = octet_length(bytes))
);
CREATE UNIQUE INDEX "PublicBlob_checksum_purpose_key" ON "PublicBlob" (checksum, purpose);
