"use client";
import { initialEditor, type Editor } from "./metadata-editor-state";
import { useRef, useState } from "react";
import type { LibraryBookInfo } from "@/lib/api-types";
import {
  metadataDraft,
  metadataChanges,
  metadataPatch,
  type PdfMetadataDraft,
} from "@/lib/api-types/pdf-metadata";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { getDb } from "@/features/offline/db";
import {
  requestPdfMetadata,
  MetadataRequestError,
} from "@/features/offline/buckets/library/pdf-imports/metadata/request";

export function useMetadataEditor(book: LibraryBookInfo) {
  const auth = useOfflineAuth();
  const online = useNetworkState();
  const scope = `${auth.userId}:${book.libraryItemId}`;
  const serial = useRef(0);
  const [value, setValue] = useState<Editor | null>(null);
  const editor = value?.scope === scope && value.db === getDb() ? value : null;
  const changes = editor?.snapshot
    ? metadataPatch(editor.snapshot, editor.draft)
    : null;
  const enabled =
    online && Boolean(auth.isLoaded && auth.isSignedIn && book.pdfImport);
  async function run(save: boolean) {
    if (!enabled || (save && !changes)) return;
    const request = ++serial.current;
    const db = getDb();
    const base = editor ?? initialEditor(book, scope);
    setValue({ ...base, pending: true, error: null });
    try {
      const snapshot = await requestPdfMetadata({
        db,
        getToken: auth.getToken,
        operationId: book.pdfImport!.operationId,
        libraryItemId: book.libraryItemId,
        ...(save && base.snapshot
          ? { edit: { snapshot: base.snapshot, draft: base.draft } }
          : {}),
      });
      if (request !== serial.current || db !== getDb()) return;
      setValue(
        save
          ? null
          : {
              ...base,
              draft: metadataDraft(snapshot),
              snapshot,
              pending: false,
              error: null,
            },
      );
    } catch (error) {
      if (request !== serial.current || db !== getDb()) return;
      setValue({
        ...base,
        pending: false,
        error:
          error instanceof MetadataRequestError && error.reason === "conflict"
            ? "conflict"
            : save
              ? "saveFailed"
              : "loadFailed",
      });
    }
  }
  return {
    editor,
    enabled,
    online,
    load: () => run(false),
    save: () => run(true),
    valid: !!editor && !!metadataChanges(editor.draft),
    close: () => {
      serial.current++;
      setValue(null);
    },
    change: (draft: PdfMetadataDraft) =>
      setValue((prior) =>
        prior?.scope === scope ? { ...prior, draft } : prior,
      ),
    canSave:
      enabled &&
      !!editor?.snapshot &&
      !editor.pending &&
      !editor.error &&
      !!changes,
  };
}
