import { useCallback } from "react";
import type React from "react";
import { useCollectionModal } from "./use-collection-modal";
import { useRenameCollection } from "./use-rename-collection";
import { useDeleteCollection } from "./use-delete-collection";
import type { LibraryCollectionActionsProps } from "./types";

export function useCollectionActions(props: LibraryCollectionActionsProps) {
  const modal = useCollectionModal(props);
  const { startTransition } = modal;
  const renameCollection = useRenameCollection(props.collectionId, modal);
  const deleteCollection = useDeleteCollection(props.collectionId, modal);
  const handleRenameSubmit = useCallback(
    (event: React.SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      startTransition(async () => {
        await renameCollection();
      });
    },
    [renameCollection, startTransition],
  );

  const handleDeleteConfirm = useCallback(() => {
    startTransition(async () => {
      await deleteCollection();
    });
  }, [deleteCollection, startTransition]);

  return { ...modal, handleRenameSubmit, handleDeleteConfirm };
}
