"use client";
import { useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { downloadPdfFormat } from "@/features/offline/buckets/library";
import type { PdfImportSummary } from "@/lib/api-types/pdf-import";

export function useFormatDownload(status: PdfImportSummary, title: string) {
  const { getToken } = useOfflineAuth();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return {
    pending,
    failed,
    download: async (format: "pdf" | "epub") => {
      if (pending) return;
      setPending(true);
      setFailed(false);
      try {
        const blob = await downloadPdfFormat(status, format, getToken);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${title.replace(/[\\/<>:"|?*\u0000-\u001f]/g, "_").slice(0, 150)}.${format}`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        setFailed(true);
      } finally {
        setPending(false);
      }
    },
  };
}
