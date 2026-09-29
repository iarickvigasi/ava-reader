"use client";
import { useState } from "react";
import { PdfImportConfirmation } from "@/components/app/shared/pdf-import/confirmation";
import { PdfImportStatus } from "@/components/app/shared/pdf-import/status";
import { PdfFormats } from "@/components/app/library/book-info/pdf-formats";
import { Button } from "@/components/ui/button";
import { pdfStatus } from "@/features/offline/buckets/library/pdf-imports/test-fixture";
import type { PdfImportSummary } from "@/lib/api-types/pdf-import";

export function PdfImportFixture() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PdfImportSummary>({
    ...pdfStatus,
    operationId: "authored-ui-fixture",
    libraryItemId: "authored-ui-fixture",
    status: "QUEUED",
  });
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 text-ink">
      <p className="text-sm text-muted">UI fixture · no upload or conversion</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)}>Open import choice</Button>
        <Button
          variant="ghost"
          onClick={() =>
            setStatus({ ...status, status: "RUNNING", failureId: null })
          }
        >
          Show processing fixture
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            setStatus({
              ...status,
              status: "FAILED",
              failureId: "fixture-failure-reference",
              investigationRecorded: true,
            })
          }
        >
          Show failure fixture
        </Button>
      </div>
      <section className="space-y-5 rounded-2xl border border-line p-6">
        <h1 className="font-reader text-3xl text-title">
          The Independent Harbour
        </h1>
        <PdfImportStatus status={status} details />
        <PdfFormats status={status} title="The Independent Harbour" />
      </section>
      {open && (
        <PdfImportConfirmation
          filename="The Independent Harbour.pdf"
          onClose={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            setStatus({
              ...status,
              status: "QUEUED",
              failureId: null,
              investigationRecorded: false,
            });
          }}
        />
      )}
    </main>
  );
}
