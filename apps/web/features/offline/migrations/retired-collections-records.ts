export function preservedCacheRecords(collectionId: string) {
  return {
    books: {
      libraryItemId: "lib-1",
      toc: [],
      chapterIds: ["ch-1"],
      metadata: {},
      fetchedAt: "before",
    },
    bookChapters: {
      libraryItemId: "lib-1",
      chapterId: "ch-1",
      index: 0,
      blocks: [{ text: "cached chapter" }],
    },
    bookCovers: {
      libraryItemId: "lib-1",
      bytes: new Uint8Array([1, 2, 3]).buffer,
    },
    highlights: { libraryItemId: "lib-1", id: "highlight", text: "annotation" },
    aiComments: { libraryItemId: "lib-1", id: "comment", body: "comment" },
    progress: { libraryItemId: "lib-1", completionPercent: 12, dirty: true },
    sessions: {
      clientSessionId: "session",
      libraryItemId: "lib-1",
      state: "stopped",
    },
    collectionMembershipMutations: {
      libraryItemId: "lib-1",
      revision: "pending",
      queuedAt: "now",
      changes: [
        { collectionId: collectionId, member: true, baselineMember: false },
      ],
    },
    finishDateMutations: {
      libraryItemId: "lib-1",
      finishedAt: null,
      revision: "pending",
      queuedAt: "now",
    },
    sessionMutations: {
      mutationId: "session",
      scopeId: "lib-1",
      queuedAt: "now",
      data: "pending",
    },
    meta: { key: "library:booksCount", value: 2, updatedAt: "before" },
  };
}
