"use client";

// Exposes the browser's storage estimate for the origin so a future
// "Saved books" settings panel can show "you've used X MB of Y MB available."
//
// `navigator.storage.estimate()` is cheap (~ms) but not free, so the hook
// recomputes only on:
//   - mount,
//   - tab regaining visibility,
//   - manual refresh from the caller (the returned `refresh` function).
//
// Some browsers return `quota = 0` when the origin hasn't yet used any
// storage; in that case `freeBytes` is null and the caller should treat it
// as "we don't know yet" rather than "out of space."

import { useCallback, useEffect, useState } from "react";

export type StorageInfo = {
  // `null` when the Storage API is unavailable (older browsers / SSR /
  // private mode) OR when the browser returned a zero quota — distinct
  // from "we know we're at zero usage", so don't display a 0% used UI.
  quotaBytes: number | null;
  usageBytes: number | null;
  freeBytes: number | null;
  // Convenience — 0..1, or null when quotaBytes is null. Use this for
  // progress bars / pie charts without re-doing the math at every callsite.
  usageFraction: number | null;
};

const EMPTY: StorageInfo = {
  quotaBytes: null,
  usageBytes: null,
  freeBytes: null,
  usageFraction: null,
};

export async function readStorageInfo(): Promise<StorageInfo> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return EMPTY;
  }
  let estimate: StorageEstimate;
  try {
    estimate = await navigator.storage.estimate();
  } catch {
    return EMPTY;
  }
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  if (!quota || quota <= 0) {
    return { ...EMPTY, usageBytes: usage > 0 ? usage : null };
  }
  const free = Math.max(0, quota - usage);
  return {
    quotaBytes: quota,
    usageBytes: usage,
    freeBytes: free,
    usageFraction: quota > 0 ? Math.min(1, usage / quota) : null,
  };
}

export function useStorageInfo(): {
  info: StorageInfo;
  refresh: () => void;
} {
  const [info, setInfo] = useState<StorageInfo>(EMPTY);

  const refresh = useCallback(() => {
    void readStorageInfo().then(setInfo);
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { info, refresh };
}

// Convenience formatter for display: "237 MB", "1.4 GB". Doesn't include
// labels because callers will want to interpolate via i18n.
export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) {
    return "0";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}
