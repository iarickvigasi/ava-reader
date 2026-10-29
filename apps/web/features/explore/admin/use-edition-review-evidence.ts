"use client";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { adminRequest } from "./admin-request";
import { useIsCatalogAdmin } from "./use-is-catalog-admin";

export function useEditionReviewEvidence(id?: string) {
  const isAdmin = useIsCatalogAdmin();
  const { getToken } = useOfflineAuth();
  const [record, setRecord] = useState<CatalogEditionDetail | null>(null);
  useEffect(() => {
    if (!isAdmin || !id) return;
    const controller = new AbortController();
    void adminRequest<CatalogEditionDetail>(
      `editions/${id}`,
      getToken,
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setRecord(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRecord(null);
      });
    return () => controller.abort();
  }, [id, isAdmin, getToken]);
  return isAdmin && record?.id === id ? record : null;
}
