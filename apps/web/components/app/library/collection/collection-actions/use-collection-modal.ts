import { useCallback, useEffect, useState, useTransition } from "react";
import type { LibraryCollectionActionsProps, ModalMode } from "./types";

export function useCollectionModal({
  collectionDescription,
  collectionName,
  initialModalMode = null,
}: LibraryCollectionActionsProps) {
  const [modalMode, setModalMode] = useState<ModalMode>(initialModalMode);
  const [draftName, setDraftName] = useState(collectionName);
  const [draftDescription, setDraftDescription] = useState(
    collectionDescription ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const closeModal = useCallback(() => {
    if (isPending) {
      return;
    }

    setModalMode(null);
    setError(null);
    setDraftName(collectionName);
    setDraftDescription(collectionDescription ?? "");
  }, [collectionDescription, collectionName, isPending]);

  const openEditModal = useCallback(() => {
    setDraftName(collectionName);
    setDraftDescription(collectionDescription ?? "");
    setError(null);
    setModalMode("edit");
  }, [collectionDescription, collectionName]);

  const openDeleteModal = useCallback(() => {
    setError(null);
    setModalMode("delete");
  }, []);

  useEffect(() => {
    if (!modalMode) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeModal, modalMode]);

  return {
    modalMode,
    setModalMode,
    draftName,
    setDraftName,
    draftDescription,
    setDraftDescription,
    error,
    setError,
    isPending,
    startTransition,
    closeModal,
    openEditModal,
    openDeleteModal,
  };
}
