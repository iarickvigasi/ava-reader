"use client";
import { usePdfImportObserver } from "@/features/library/pdf-imports/use-pdf-import-observer";

import { PdfImportNotice } from "../shared/pdf-import/notice";

export function PdfImportObserver() {
  usePdfImportObserver();
  return <PdfImportNotice />;
}
