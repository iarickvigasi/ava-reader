"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import {
  acquireAdminPreview,
  acquireCatalogBook,
} from "@/features/offline/buckets/library";
import { getReaderHref } from "@/lib/app-routes";

export function useCatalogRead(
  entryId: string,
  draft?: { editionId: string; checksum: string },
) {
  const { getToken } = useOfflineAuth();
  const router = useRouter();
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    mounted.current = true;
    setPending(false);
    setError(false);
    return () => {
      mounted.current = false;
      operation.current?.abort();
      operation.current = null;
    };
  }, [entryId, draft?.editionId, draft?.checksum]);
  const read = async () => {
    if (operation.current || !mounted.current) return;
    const controller = new AbortController();
    operation.current = controller;
    const origin = window.location.href;
    setPending(true);
    setError(false);
    try {
      const target = await (draft
        ? acquireAdminPreview(draft, getToken, controller.signal)
        : acquireCatalogBook(entryId, getToken, controller.signal));
      if (
        mounted.current &&
        !controller.signal.aborted &&
        window.location.href === origin
      )
        router.push(getReaderHref(target.slug));
    } catch {
      if (mounted.current && !controller.signal.aborted) setError(true);
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        if (mounted.current) setPending(false);
      }
    }
  };
  return { read, pending, error };
}
