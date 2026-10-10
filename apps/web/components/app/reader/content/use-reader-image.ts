import { useState } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { useReaderResources } from "./reader-resources-context";

export function useReaderImage(block: Extract<ReaderBlock, { kind: "image" }>) {
  const context = useReaderResources();
  const resource = block.resourceId
    ? context?.snapshot[block.resourceId]
    : undefined;
  const src = resource?.src ?? block.src;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const missing = !src || failedSrc === src;
  const remote =
    block.resourceId && context?.recovery.canRetry(block.resourceId);
  return {
    src,
    attempt,
    missing,
    loading: resource?.status === "loading",
    canRetry: Boolean(remote || block.src),
    fail() {
      setFailedSrc(src);
      if (block.resourceId) context?.recovery.fail(block.resourceId);
    },
    async retry() {
      if (remote && block.resourceId) {
        if (!(await context!.recovery.retry(block.resourceId))) return false;
      } else if (!block.src) return false;
      setFailedSrc(null);
      setAttempt((value) => value + 1);
      return true;
    },
  };
}
