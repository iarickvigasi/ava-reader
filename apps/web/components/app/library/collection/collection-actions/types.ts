export type ModalMode = "delete" | "edit" | null;
export type LibraryCollectionActionsProps = {
  collectionDescription: null | string;
  collectionId: string;
  collectionKind: "CUSTOM" | "SMART";
  collectionName: string;
  initialModalMode?: ModalMode;
};
