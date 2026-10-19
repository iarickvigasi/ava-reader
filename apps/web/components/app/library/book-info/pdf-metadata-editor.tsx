"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import type { LibraryBookInfo } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/app/library/collection/collection-actions/modal-shell";
import { useMetadataEditor } from "@/features/library/pdf-imports/use-metadata-editor";
import { PdfMetadataFields } from "./pdf-metadata-fields";

export function PdfMetadataEditor({ book }: { book: LibraryBookInfo }) {
  const t = useTranslations("pdfImport.metadata");
  const id = useId();
  const state = useMetadataEditor(book);
  const { editor } = state;
  return (
    <>
      <div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!state.enabled}
          onClick={() => void state.load()}
        >
          {t("edit")}
        </Button>
        {!state.online && <p className="text-sm text-muted">{t("offline")}</p>}
      </div>
      {editor && (
        <ModalShell labelledBy={id} onClose={state.close} maxWidth="md">
          <form
            className="space-y-5 rounded-modal bg-surface p-6 text-ink shadow-(--shadow-card)"
            onSubmit={(event) => {
              event.preventDefault();
              if (state.canSave) void state.save();
            }}
          >
            <h2 id={id} className="font-reader text-2xl">
              {t("edit")}
            </h2>
            <PdfMetadataFields
              draft={editor.draft}
              onChange={state.change}
              disabled={editor.pending || !editor.snapshot}
            />
            {editor.pending && <p role="status">{t("working")}</p>}
            {editor.error && (
              <p role="alert" className="text-sm text-danger">
                {t(editor.error)}
              </p>
            )}
            {editor.snapshot && !editor.pending && !state.valid && (
              <p role="status" className="text-sm text-danger">
                {t("invalid")}
              </p>
            )}
            {!state.online && (
              <p role="status" className="text-sm text-muted">
                {t("offline")}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="soft"
                onClick={state.close}
              >
                {t("close")}
              </Button>
              {editor.error && (
                <Button
                  type="button"
                  size="sm"
                  variant="soft"
                  disabled={!state.enabled || editor.pending}
                  onClick={() => void state.load()}
                >
                  {t("reload")}
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!state.canSave}>
                {t("save")}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}
