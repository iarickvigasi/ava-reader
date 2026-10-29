"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { adminRequest } from "./admin-request";
import { editData } from "./edit-data";
import type { EditData, EditorialKind, EditorialRecord } from "./types";

export function useEditorialDialog(
  kind: EditorialKind,
  id: string,
  remove: boolean,
  close: () => void,
) {
  const t = useTranslations("explore.editorialForm");
  const { getToken } = useOfflineAuth();
  const router = useRouter();
  const [record, setRecord] = useState<EditorialRecord | null>(null);
  const [data, setData] = useState<EditData>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void adminRequest<EditorialRecord>(
      `${kind}/${id}`,
      getToken,
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setRecord(value);
          setData(editData(kind, value));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(t("loadFailed"));
      });
    return () => controller.abort();
  }, [kind, id, getToken, t]);
  async function save() {
    if (!record || pending) return;
    setPending(true);
    setError("");
    try {
      await adminRequest(`${kind}/${id}${remove ? "/delete" : ""}`, getToken, {
        revision: record.revision,
        data,
      });
      window.dispatchEvent(new Event("ava:catalog-updated"));
      if (remove) router.push("/app/explore");
      close();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setPending(false);
    }
  }
  return {
    record,
    data,
    pending,
    error,
    save,
    change: (key: string, value: unknown) =>
      setData((current) => ({ ...current, [key]: value })),
  };
}
