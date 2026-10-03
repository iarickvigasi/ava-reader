export type PdfNotice = {
  id: string;
  operationId: string;
  libraryItemId: string;
  kind: "pdf_import_ready" | "pdf_import_failed";
  createdAt: string;
  deliveredAt: string | null;
  acknowledgedAt?: string;
  dirty?: "delivered" | "acknowledged" | null;
};
export type PdfNoticeView = PdfNotice & { title: string; slug: string };
export const PDF_NOTICE_PREFIX = "pdf-import-notice:";
export function readPdfNotice(value: unknown): PdfNotice | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    ![v.id, v.operationId, v.libraryItemId].every(
      (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id),
    ) ||
    !["pdf_import_ready", "pdf_import_failed"].includes(v.kind as string) ||
    typeof v.createdAt !== "string" ||
    !Number.isFinite(Date.parse(v.createdAt)) ||
    (v.deliveredAt !== null &&
      (typeof v.deliveredAt !== "string" ||
        !Number.isFinite(Date.parse(v.deliveredAt))))
  )
    return null;
  return {
    id: v.id as string,
    operationId: v.operationId as string,
    libraryItemId: v.libraryItemId as string,
    kind: v.kind as PdfNotice["kind"],
    createdAt: v.createdAt,
    deliveredAt: v.deliveredAt as string | null,
  };
}
