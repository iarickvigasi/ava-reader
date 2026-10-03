import { useEffect, useRef, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { getActiveUserId } from "@/features/offline/db";
import { downloadLibraryFormat } from "./request";

export function useBookDownload(libraryItemId: string, title: string) {
  const { getToken, userId } = useOfflineAuth();
  const flight = useRef<AbortController | null>(null);
  const [state, setState] = useState<{
    owner: string | null | undefined;
    item: string;
    pending: boolean;
    failed: boolean;
  } | null>(null);
  useEffect(
    () => () => {
      flight.current?.abort();
      flight.current = null;
    },
    [userId, libraryItemId],
  );
  const current = state?.owner === userId && state?.item === libraryItemId;
  return {
    pending: current && !!state?.pending,
    failed: current && !!state?.failed,
    download: async (format: "pdf" | "epub") => {
      if (flight.current || !userId || userId !== getActiveUserId()) return;
      const controller = new AbortController();
      flight.current = controller;
      const owns = () =>
        !controller.signal.aborted && userId === getActiveUserId();
      const publish = (pending: boolean, failed: boolean) => {
        if (owns())
          setState({ owner: userId, item: libraryItemId, pending, failed });
      };
      publish(true, false);
      try {
        const blob = await downloadLibraryFormat(
          libraryItemId,
          format,
          getToken,
          controller.signal,
        );
        if (!owns()) return;
        const url = URL.createObjectURL(blob);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${title.replace(/[\\/<>:"|?*\u0000-\u001f]/g, "_").slice(0, 150) || "book"}.${format}`;
        document.body.append(anchor);
        try {
          anchor.click();
        } finally {
          anchor.remove();
        }
        publish(false, false);
      } catch {
        publish(false, true);
      } finally {
        if (flight.current === controller) flight.current = null;
      }
    },
  };
}
