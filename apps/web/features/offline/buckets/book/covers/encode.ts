import { coverChecksum } from "./checksum";
import type { CoverRow } from "./types";

export async function encodeCover(
  blob: Blob,
  identity: Pick<CoverRow, "libraryItemId" | "sourceUrl" | "verified">,
): Promise<CoverRow> {
  const bytes = await blob.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength !== blob.size) {
    throw new Error("Cover bytes disagree with Blob size");
  }
  return {
    ...identity,
    bytes,
    mimeType: blob.type,
    byteLength: bytes.byteLength,
    sha256: await coverChecksum(bytes),
  };
}
