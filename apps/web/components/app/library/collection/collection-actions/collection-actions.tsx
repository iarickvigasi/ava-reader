"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { LibraryCollectionDeletePayload, LibraryCollectionRenamePayload, } from "@/lib/api-types";
import { CollectionActionButtons } from "./action-buttons";
import { DeleteCollectionModal } from "./delete-modal";
import { EditCollectionModal } from "./edit-modal";
import { ModalShell } from "./modal-shell";

type ModalMode = "delete" | "edit" | null;

type LibraryCollectionActionsProps = {
  collectionDescription: null | string;
  collectionId: string;
    collectionKind: "CUSTOM" | "SMART";
  collectionName: string;
  initialModalMode?: ModalMode;
};

export function LibraryCollectionActions({
  collectionDescription,
  collectionId,
  collectionKind,
  collectionName,
  initialModalMode = null,
}: LibraryCollectionActionsProps) {
  const tErrors = useTranslations("library.collectionActions.errors");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
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

  const renameCollection = useCallback(async () => {
    const name = draftName.trim();
    const description = draftDescription.trim();

    if (!name) {
      setError(tErrors("nameEmpty"));
      return;
    }

    if (!isLoaded || !isSignedIn) {
      setError(tErrors("signInToEdit"));
      return;
    }

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
      const payload = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;
      setError(readApiErrorMessage(payload, tErrors("updateFailed")));
      return;
    }

    await response.json().catch(
      () => null as LibraryCollectionRenamePayload | null,
    );
    setError(null);
    setModalMode(null);
    router.refresh();
  }, [
    collectionId,
    draftDescription,
    draftName,
    getToken,
    isLoaded,
    isSignedIn,
    router,
    tErrors,
  ]);

  const deleteCollection = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setError(tErrors("signInToDelete"));
      return;
    }

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
      const payload = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;
      setError(readApiErrorMessage(payload, tErrors("deleteFailed")));
      return;
    }

    await response.json().catch(
      () => null as LibraryCollectionDeletePayload | null,
    );
    setError(null);
    setModalMode(null);
    router.push("/app/library");
    router.refresh();
  }, [collectionId, getToken, isLoaded, isSignedIn, router, tErrors]);

  const handleRenameSubmit = useCallback(
    (event: React.SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      startTransition(() => {
        void renameCollection();
      });
    },
    [renameCollection, startTransition],
  );

  const handleDeleteConfirm = useCallback(() => {
    startTransition(() => {
      void deleteCollection();
    });
  }, [deleteCollection, startTransition]);

  // Smart collections are system-owned: the API rejects both renaming and
  // deleting them, so neither control is offered. Deleting one only made it
  // reappear on the next import.
  if (collectionKind === "SMART") {
    return null;
  }

  return (
    <>
      <CollectionActionButtons
        onDeleteClick={openDeleteModal}
        onEditClick={openEditModal}
      />

      {modalMode ? (
        <ModalShell onClose={closeModal}>
          {modalMode === "edit" ? (
            <EditCollectionModal
              collectionDescription={draftDescription}
              collectionName={draftName}
              error={error}
              isPending={isPending}
              onClose={closeModal}
              onDescriptionChange={setDraftDescription}
              onNameChange={setDraftName}
              onSubmit={handleRenameSubmit}
            />
          ) : (
            <DeleteCollectionModal
              collectionName={collectionName}
              error={error}
              isPending={isPending}
              onClose={closeModal}
              onConfirmDelete={handleDeleteConfirm}
            />
          )}
        </ModalShell>
      ) : null}
    </>
  );
}

function readApiErrorMessage(
  payload: { message?: string | string[] } | null,
  fallback: string,
) {
  if (!payload?.message) {
    return fallback;
  }

  if (Array.isArray(payload.message)) {
    return payload.message[0] ?? fallback;
  }

  return payload.message;
}
