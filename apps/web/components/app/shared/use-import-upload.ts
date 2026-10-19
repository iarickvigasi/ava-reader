"use client";

import { useLayoutEffect, useRef, useTransition } from "react";
import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  importPdfFile,
  revalidateLibrary,
} from "@/features/offline/buckets/library";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { APP_LIBRARY_HREF, getLibraryBookInfoHref } from "@/lib/app-routes";
import { getPublicApiBaseUrl } from "@/lib/api";

import type {
  ImportResult,
  PdfCopyChoice,
} from "@/features/offline/buckets/library/pdf-imports/types";

type UseImportUploadOptions = {
  onDuplicateAction?: (
    file: File,
    result: ImportResult,
    ownerId: string | null | undefined,
  ) => void;
  onNoticeAction: (notice: string | null) => void;
};

export function useImportUpload({
  onNoticeAction,
  onDuplicateAction,
}: UseImportUploadOptions) {
  const t = useTranslations("shared.import");
  const pdf = useTranslations("pdfImport");
  const { getToken, isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const router = useRouter();
  const online = useNetworkState();
  const [isUploading, startTransition] = useTransition();
  const ownerKey = userId ? `${userId}:${sessionId ?? ""}` : undefined;
  const completion = useRef({ ownerKey, generation: 0 });
  useLayoutEffect(() => {
    completion.current.ownerKey = ownerKey;
    completion.current.generation++;
    return () => {
      completion.current.generation++;
    };
  }, [ownerKey]);

  async function uploadFile(
    file: File,
    copy: PdfCopyChoice | undefined,
    isCurrent: () => boolean,
  ) {
    if (!isCurrent()) return;
    if (!online) {
      onNoticeAction(pdf("connect"));
      return;
    }
    if (!isLoaded || !isSignedIn) {
      onNoticeAction(t("signIn"));
      return;
    }

    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const result = await importPdfFile(file, getToken, copy);
      if (!isCurrent()) return;
      if (result.state === "duplicate") {
        onDuplicateAction?.(file, result, ownerKey);
        return;
      }
      onNoticeAction(pdf(result.state));
      if (result.libraryItemId)
        router.push(
          result.slug
            ? getLibraryBookInfoHref(encodeURIComponent(result.slug))
            : APP_LIBRARY_HREF,
        );
      return;
    }

    const token = await getToken();
    if (!isCurrent()) return;

    if (!token) {
      onNoticeAction(t("noToken"));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("originalFilename", file.name);

    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/library/import`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );

    if (!isCurrent()) return;
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (isCurrent()) onNoticeAction(payload?.message ?? t("uploadFailed"));
      return;
    }

    onNoticeAction(t("imported", { filename: file.name }));
    await revalidateLibrary(getToken);
    if (isCurrent()) router.refresh();
  }

  function upload(file: File, copy?: PdfCopyChoice) {
    const generation = ++completion.current.generation;
    const isCurrent = () =>
      completion.current.ownerKey === ownerKey &&
      completion.current.generation === generation;
    startTransition(async () => {
      try {
        await uploadFile(file, copy, isCurrent);
      } catch {
        if (isCurrent()) onNoticeAction(t("uploadFailed"));
      }
    });
  }

  return { isUploading, upload, ownerId: ownerKey };
}
