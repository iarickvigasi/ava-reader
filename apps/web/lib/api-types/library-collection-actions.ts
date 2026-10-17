import type { LibraryBookInfo, LibraryCollection } from "./library";

export type LibraryCollectionRenamePayload = {
  collectionId: string;
  description: string | null;
  name: string;
};

export type LibraryCollectionDeletePayload = {
  collectionId: string;
  state: "deleted";
};

export type LibraryBookCollectionsInput = {
  libraryItemId: string;
  addCollectionIds: string[];
  removeCollectionIds: string[];
};

export type LibraryBookCollectionsPayload = {
  libraryItemId: string;
  collections: LibraryBookInfo["collections"];
  affectedCollections: LibraryCollection[];
};
