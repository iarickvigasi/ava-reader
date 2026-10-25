"use client";
import { CollectionActionButtons } from "./action-buttons";
import { DeleteCollectionModal } from "./delete-modal";
import { EditCollectionModal } from "./edit-modal";
import { ModalShell } from "./modal-shell";
import { useCollectionActions } from "./use-collection-actions";
import type { LibraryCollectionActionsProps } from "./types";

export function LibraryCollectionActions(props: LibraryCollectionActionsProps) {
  const { collectionKind, collectionName } = props;
  const {
    modalMode,
    draftName,
    draftDescription,
    error,
    isPending,
    openDeleteModal,
    openEditModal,
    closeModal,
    setDraftDescription,
    setDraftName,
    handleRenameSubmit,
    handleDeleteConfirm,
  } = useCollectionActions(props);
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
        <ModalShell
          onClose={closeModal}
          maxWidth={modalMode === "delete" ? "md" : "2xl"}
        >
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
