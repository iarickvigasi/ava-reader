import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
import { getDb } from "../../../db";
import { pdfImportRequest } from "./request";
import type { GetToken } from "./types";

export async function downloadPdfFormat(
  status: PdfImportSummary,
  format: "pdf" | "epub",
  getToken: GetToken,
) {
  const db = getDb();
  if (
    format === "epub" &&
    (status.status !== "READY" || !status.finalContentId)
  )
    throw new Error("FORMAT_UNAVAILABLE");
  const suffix =
    format === "pdf"
      ? `artifacts/${encodeURIComponent(status.sourceArtifactId)}`
      : "formats/epub";
  const response = await pdfImportRequest(
    db,
    getToken,
    `/${encodeURIComponent(status.operationId)}/${suffix}`,
  );
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const blob = await response.blob();
  if (db !== getDb()) throw new Error("ACCOUNT_CHANGED");
  return blob;
}
