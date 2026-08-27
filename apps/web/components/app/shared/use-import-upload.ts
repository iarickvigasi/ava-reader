"use client";

import { useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getPublicApiBaseUrl } from "@/lib/api";

type UseImportUploadOptions = {
  onNotice: (notice: string | null) => void;
};

// Upload state + side effects behind ImportButton. The transition callback is
// async and awaited, so `isUploading` spans the whole request — the old inline
// version fired the promise without awaiting it, ending the transition (and
// the "Uploading…" label) before the upload had even started. router.refresh()
// runs inside the same action, extending the pending state into the refresh.
export function useImportUpload({ onNotice }: UseImportUploadOptions) {
  const t = useTranslations("shared.import");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [isUploading, startTransition] = useTransition();

  async function uploadFile(file: File) {
    if (!isLoaded || !isSignedIn) {
      onNotice(t("signIn"));
      return;
    }

    const token = await getToken();

    if (!token) {
      onNotice(t("noToken"));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${getPublicApiBaseUrl()}/api/library/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      onNotice(payload?.message ?? t("uploadFailed"));
      return;
    }

    onNotice(t("imported", { filename: file.name }));
    router.refresh();
  }

  function upload(file: File) {
    startTransition(async () => {
      await uploadFile(file);
    });
  }

  return { isUploading, upload };
}
