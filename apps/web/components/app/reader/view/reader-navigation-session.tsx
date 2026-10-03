import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import type { ReadyReaderProps } from "../shared/types";
import { ReaderNavigationState } from "./reader-navigation-state";

export function ReaderNavigationSession(props: ReadyReaderProps) {
  const { userId } = useOfflineAuth();
  const identity = props.payload.readerPackage?.final_content_id ?? "legacy";
  return (
    <ReaderNavigationState
      key={`${userId}:${props.libraryItemId}:${identity}`}
      {...props}
    />
  );
}
