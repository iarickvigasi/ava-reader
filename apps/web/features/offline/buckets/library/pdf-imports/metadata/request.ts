import {
  readPdfMetadata,
  type PdfMetadata,
  type PdfMetadataDraft,
  metadataChanges,
  metadataPatch,
} from "@/lib/api-types/pdf-metadata";
import { getDb, type AvaReaderDB } from "../../../../db";
import { isLibraryItemDeleted } from "../../deleted-items";
import { refreshFromDb } from "../../bucket";
import { pdfImportRequest } from "../request";
import type { GetToken } from "../types";
import { applyPdfMetadata } from "./storage";

export class MetadataRequestError extends Error {
  constructor(public readonly reason: "conflict" | "unavailable" | "invalid") {
    super(reason);
  }
}
export async function requestPdfMetadata(input: {
  db: AvaReaderDB;
  getToken: GetToken;
  operationId: string;
  libraryItemId: string;
  edit?: { snapshot: PdfMetadata; draft: PdfMetadataDraft };
}) {
  const { db, operationId, libraryItemId } = input;
  if (db !== getDb() || (await isLibraryItemDeleted(db, libraryItemId)))
    throw new MetadataRequestError("unavailable");
  const changes = input.edit
    ? metadataPatch(input.edit.snapshot, input.edit.draft)
    : null;
  if (
    input.edit &&
    (!readPdfMetadata(input.edit.snapshot) ||
      !metadataChanges(input.edit.draft) ||
      input.edit.snapshot.operationId !== operationId ||
      input.edit.snapshot.libraryItemId !== libraryItemId)
  )
    throw new MetadataRequestError("invalid");
  if (input.edit && !changes) {
    if (db !== getDb()) throw new MetadataRequestError("unavailable");
    return input.edit.snapshot;
  }
  const response = await pdfImportRequest(
    db,
    input.getToken,
    `/${encodeURIComponent(operationId)}/metadata`,
    input.edit
      ? {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...changes,
            expectedVersion: input.edit.snapshot.metadataEditVersion,
          }),
        }
      : undefined,
  );
  if (!response.ok)
    throw new MetadataRequestError(
      response.status === 409 ? "conflict" : "unavailable",
    );
  const metadata = readPdfMetadata(await response.json());
  if (
    !metadata ||
    metadata.operationId !== operationId ||
    metadata.libraryItemId !== libraryItemId ||
    db !== getDb()
  )
    throw new MetadataRequestError("unavailable");
  if (!(await applyPdfMetadata(db, metadata)))
    throw new MetadataRequestError("unavailable");
  await refreshFromDb();
  return metadata;
}
