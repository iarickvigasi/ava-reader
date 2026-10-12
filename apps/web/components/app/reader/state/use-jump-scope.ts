import { useMountedDeviceOwner } from "@/features/offline/lifecycle/device-owner-context";
import { READER_BUILD_FINGERPRINT } from "@/features/reader/canonical/build";
import type { ReadyReaderProps } from "../shared/types";
import type { NavigationScope } from "@/features/reader/navigation-scope";
export function useJumpScope(props: ReadyReaderProps): NavigationScope {
  const ownerId = useMountedDeviceOwner();
  return {
    accountId: ownerId,
    libraryItemId: props.libraryItemId,
    finalContentId: props.payload.readerPackage?.final_content_id ?? "legacy",
    readerFingerprint: READER_BUILD_FINGERPRINT,
  };
}
