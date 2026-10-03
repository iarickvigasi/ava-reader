export type PdfUploadIntent = {
  requestKey: string;
  sourceSha256: string;
  filename: string;
  createdAt: string;
  libraryItemId?: string;
  rejected?: boolean;
};
export type GetToken = () => Promise<string | null>;
export type ImportResult = {
  state: "accepted" | "existing" | "uncertain" | "rejected";
  libraryItemId?: string;
  slug?: string;
  code?: string;
};
