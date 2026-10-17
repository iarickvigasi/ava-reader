import { useMountedDeviceOwner } from "@/features/offline/lifecycle/device-owner-context";
import type { ReadyReaderProps } from "../shared/types";
import { ReaderNavigationState } from "./reader-navigation-state";
import { ReaderResourcesProvider } from "../content/reader-resources-context";

export function ReaderNavigationSession(props: ReadyReaderProps) {
  const ownerId = useMountedDeviceOwner();
  const identity = props.payload.readerPackage?.final_content_id ?? "legacy";
  const scope = `${ownerId}:${props.libraryItemId}:${identity}`;
  return (
    <ReaderResourcesProvider key={scope} payload={props.payload}>
      <ReaderNavigationState key={scope} {...props} />
    </ReaderResourcesProvider>
  );
}
