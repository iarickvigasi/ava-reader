import { coverChecksum } from "./checksum";
import type { CoverRow } from "./types";

export async function isValidCover(
  row: CoverRow | undefined,
): Promise<boolean> {
  if (!row || !(row.bytes instanceof ArrayBuffer) || !row.byteLength)
    return false;
  return (
    row.bytes.byteLength === row.byteLength &&
    (await coverChecksum(row.bytes)) === row.sha256
  );
}
