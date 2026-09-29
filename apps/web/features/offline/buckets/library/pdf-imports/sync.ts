import { syncPdfNotices } from "./notifications/sync";
import { setPdfObservationHealth } from "./observation-health";
import { getDb } from "../../../db";
import { revalidateLibrary } from "../revalidate";
import { applyPdfImportStatus } from "./apply-status";
import { readPdfImportStatus } from "./read-status";
import { reconcilePdfRequest } from "./reconcile-request";
import { pdfImportRequest } from "./request";
import { pendingPdfUploadIntents } from "./storage";
import type { GetToken } from "./types";

export async function observePdfImports(getToken: GetToken) {
  const db = getDb();
  try {
    let changed = await syncPdfNotices(db, getToken);
    for (const intent of await pendingPdfUploadIntents(db)) {
      if (db !== getDb()) return;
      if (await reconcilePdfRequest(db, getToken, intent)) changed = true;
    }
    const rows = await db.libraryItems.toArray();
    const ids = rows.flatMap((row) =>
      row.pdfImport &&
      !["READY", "FAILED", "STOPPED"].includes(row.pdfImport.status)
        ? [row.pdfImport.operationId]
        : [],
    );
    for (let offset = 0; offset < ids.length; offset += 100) {
      const response = await pdfImportRequest(
        db,
        getToken,
        `/observations/list?ids=${encodeURIComponent(ids.slice(offset, offset + 100).join(","))}`,
      );
      if (!response.ok) throw new Error("STATUS_UNAVAILABLE");
      const payload = (await response.json()) as { imports?: unknown[] };
      if (db !== getDb()) return;
      for (const raw of payload.imports ?? []) {
        const status = readPdfImportStatus(raw);
        if (status)
          changed = (await applyPdfImportStatus(db, status)) || changed;
      }
    }
    if (changed && db === getDb()) await revalidateLibrary(getToken);
    setPdfObservationHealth(db, true);
    return ids.length > 0;
  } catch (error) {
    setPdfObservationHealth(db, false);
    throw error;
  }
}
