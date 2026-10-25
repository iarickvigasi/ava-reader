import { useCallback } from "react";
import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPublicApiBaseUrl } from "@/lib/api";
import { revalidateLibrary } from "@/features/offline/buckets/library";
import { readCollectionError } from "./read-collection-error";
import type { useCollectionModal } from "./use-collection-modal";
import {
  collectionFieldErrors,
  normalizeCollectionText,
} from "../../shared/collection-input";

export function useRenameCollection(
  collectionId: string,
  modal: ReturnType<typeof useCollectionModal>,
) {
  const {
    draftName,
    draftDescription,
    setDraftName,
    setDraftDescription,
    setError,
    setModalMode,
  } = modal;
  const tErrors = useTranslations("library.collectionActions.errors");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  return useCallback(async () => {
    const name = normalizeCollectionText(draftName);
    const description = normalizeCollectionText(draftDescription);
    setDraftName(name);
    setDraftDescription(description);

    const fields = collectionFieldErrors(name, description);
    if (fields.name || fields.description) {
      setError(tErrors(fields.name ?? fields.description!));
      return;
    }

    if (!isLoaded || !isSignedIn) {
      setError(tErrors("signInToEdit"));
      return;
    }

    try {
      const token = await getToken();

      if (!token) {
        setError(tErrors("noToken"));
        return;
      }

      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/library/collections/${collectionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            description,
            name,
          }),
        },
      );

      if (!response.ok) {
        setError(await readCollectionError(response, tErrors));
        return;
      }

      setError(null);
      setModalMode(null);
      void revalidateLibrary(getToken).catch(() => {});
      router.refresh();
    } catch {
      setError(tErrors("updateFailed"));
    }
  }, [
    collectionId,
    draftDescription,
    draftName,
    getToken,
    isLoaded,
    isSignedIn,
    router,
    tErrors,
    setDraftName,
    setDraftDescription,
    setError,
    setModalMode,
  ]);
}
