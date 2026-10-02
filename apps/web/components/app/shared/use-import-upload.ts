"use client";

import { useTransition } from "react";
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

type UseImportUploadOptions = {
  onNoticeAction: (notice: string | null) => void;
};

export function useImportUpload({ onNoticeAction }: UseImportUploadOptions) {
  const t = useTranslations("shared.import");
  const pdf = useTranslations("pdfImport");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const online = useNetworkState();
  const [isUploading, startTransition] = useTransition();

  async function uploadFile(file: File) {
    if (!online) {
      onNoticeAction(pdf("connect"));
      return;
    }
    if (!isLoaded || !isSignedIn) {
      onNoticeAction(t("signIn"));
      return;
    }

    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const result = await importPdfFile(file, getToken);
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

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      onNoticeAction(payload?.message ?? t("uploadFailed"));
      return;
    }

    onNoticeAction(t("imported", { filename: file.name }));
    await revalidateLibrary(getToken);
    router.refresh();
  }

  function upload(file: File) {
    startTransition(async () => {
      try {
        await uploadFile(file);
      } catch {
        onNoticeAction(t("uploadFailed"));
      }
    });
  }

  return { isUploading, upload };
}
