export type CoverRow = {
  libraryItemId: string;
  bytes: ArrayBuffer;
  mimeType: string;
  byteLength: number;
  sha256: string;
  sourceUrl: string | null;
  verified: boolean;
};
