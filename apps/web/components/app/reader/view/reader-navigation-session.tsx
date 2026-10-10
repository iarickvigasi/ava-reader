import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import type { ReadyReaderProps } from "../shared/types";
import { ReaderNavigationState } from "./reader-navigation-state";
import { ReaderResourcesProvider } from "../content/reader-resources-context";

export function ReaderNavigationSession(props: ReadyReaderProps) {
  const { userId } = useOfflineAuth();
  const identity = props.payload.readerPackage?.final_content_id ?? "legacy";
  const scope = `${userId}:${props.libraryItemId}:${identity}`;
  return (
    <ReaderResourcesProvider key={scope} payload={props.payload}>
      <ReaderNavigationState key={scope} {...props} />
    </ReaderResourcesProvider>
  );
}
