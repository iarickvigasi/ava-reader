import { useCallback } from "react";
import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPublicApiBaseUrl } from "@/lib/api";
import {
  revalidateLibrary,
  removeCollectionFromCache,
} from "@/features/offline/buckets/library";
import { readApiErrorMessage } from "./read-api-error-message";
import type { useCollectionModal } from "./use-collection-modal";
import type { LibraryCollectionDeletePayload } from "@/lib/api-types";

export function useDeleteCollection(
  collectionId: string,
  modal: ReturnType<typeof useCollectionModal>,
) {
  const { setError, setModalMode } = modal;
  const tErrors = useTranslations("library.collectionActions.errors");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  return useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setError(tErrors("signInToDelete"));
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
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          code?: string;
          message?: string | string[];
        } | null;
        setError(readApiErrorMessage(payload, tErrors("deleteFailed")));
        return;
      }

      await response
        .json()
        .catch(() => null as LibraryCollectionDeletePayload | null);
      setError(null);
      setModalMode(null);
      await removeCollectionFromCache(collectionId);
      await revalidateLibrary(getToken);
      router.push("/app/library");
      router.refresh();
    } catch {
      setError(tErrors("deleteFailed"));
    }
  }, [
    collectionId,
    getToken,
    isLoaded,
    isSignedIn,
    router,
    tErrors,
    setError,
    setModalMode,
  ]);
}
