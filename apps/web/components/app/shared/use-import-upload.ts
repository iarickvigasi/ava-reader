"use client";

import { useTransition } from "react";
import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { revalidateLibrary } from "@/features/offline/buckets/library";
import { getPublicApiBaseUrl } from "@/lib/api";

type UseImportUploadOptions = {
  onNoticeAction: (notice: string | null) => void;
};

// Upload state + side effects behind ImportButton. The transition callback is
// async and awaited, so `isUploading` spans the whole request — the old inline
// version fired the promise without awaiting it, ending the transition (and
// the "Uploading…" label) before the upload had even started. router.refresh()
// runs inside the same action, extending the pending state into the refresh.
//
// router.refresh() alone doesn't show the new book on /app/library: that screen
// reads the library bucket once hydrated and useHydrateLibrary treats its RSC
// payload as a one-shot, so a refreshed payload repaints stale cache. Import
// therefore revalidates the bucket itself (spec 3.1); the router refresh stays
// for the RSC-only surfaces (home).
export function useImportUpload({ onNoticeAction }: UseImportUploadOptions) {
  const t = useTranslations("shared.import");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [isUploading, startTransition] = useTransition();

  async function uploadFile(file: File) {
    if (!isLoaded || !isSignedIn) {
      onNoticeAction(t("signIn"));
      return;
    }

    const token = await getToken();

    if (!token) {
      onNoticeAction(t("noToken"));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

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
      await uploadFile(file);
    });
  }

  return { isUploading, upload };
}
