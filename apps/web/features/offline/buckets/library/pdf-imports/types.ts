export type PdfUploadIntent = {
  requestKey: string;
  sourceSha256: string;
  filename: string;
  createdAt: string;
  libraryItemId?: string;
  copyOfOperationId?: string;
  duplicateOperationId?: string;
  rejected?: boolean;
  refusalCode?: "PDF_ADMISSION_REFUSED";
};
export type GetToken = () => Promise<string | null>;
export type ImportResult = {
  state: "accepted" | "existing" | "duplicate" | "uncertain" | "rejected";
  operationId?: string;
  requestKey?: string;
  libraryItemId?: string;
  copyOfOperationId?: string;
  slug?: string;
  code?: string;
};

export type PdfCopyChoice = { operationId: string; requestKey: string };
