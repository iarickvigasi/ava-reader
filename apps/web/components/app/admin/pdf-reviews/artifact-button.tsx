"use client";
import { useEffect, useRef, useState } from "react";
import { reviewArtifact } from "@/features/admin/pdf-reviews/request";
import type {
  ReviewFile,
  ReviewRequest,
} from "@/features/admin/pdf-reviews/types";
export function ReviewArtifactButton({
  operationId,
  file,
  label,
  filename,
  request,
}: {
  operationId: string;
  file: ReviewFile;
  label: string;
  filename: string;
  request: ReviewRequest;
}) {
  const mounted = useRef(false);
  const urls = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const createdUrls = urls.current;
    return () => {
      mounted.current = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  async function download() {
    setBusy(true);
    setError(false);
    try {
      const blob = await reviewArtifact(request, operationId, file);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        disabled={busy}
        onClick={() => void download()}
        className="rounded-control border border-line px-3 py-2"
      >
        {busy ? "Preparing…" : label}
      </button>
      {error && <span role="alert">Download unavailable.</span>}
    </span>
  );
}
