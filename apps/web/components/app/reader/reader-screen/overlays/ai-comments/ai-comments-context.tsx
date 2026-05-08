"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAiComments, type AiCommentRecord } from "./use-ai-comments";

type AiCommentsContextValue = {
  comments: AiCommentRecord[];
  refetch: () => void;
};

const AiCommentsContext = createContext<AiCommentsContextValue | null>(null);

export function AiCommentsProvider({
  libraryItemId,
  children,
}: {
  libraryItemId: string;
  children: ReactNode;
}) {
  const { comments, refetch } = useAiComments(libraryItemId);

  const value = useMemo<AiCommentsContextValue>(
    () => ({ comments, refetch }),
    [comments, refetch],
  );

  return (
    <AiCommentsContext.Provider value={value}>
      {children}
    </AiCommentsContext.Provider>
  );
}

export function useAiCommentsContext() {
  const value = useContext(AiCommentsContext);

  if (!value) {
    throw new Error(
      "useAiCommentsContext must be used within an AiCommentsProvider.",
    );
  }

  return value;
}
