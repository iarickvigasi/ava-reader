import { useEffect, useRef } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { getActiveUserId } from "@/features/offline/db";
import type { ReaderControllerAuth } from "../../../shared/types";
import { READER_STATUS_READY } from "../../../shared/constants";
import { trackReaderSession } from "./track-reader-session";

type Input = ReaderControllerAuth & {
  libraryItemId: string;
  payloadStatus: ReaderStatusPayload["status"];
  remotePersistenceEnabled: boolean;
};

export function useReaderSessionTracking(input: Input) {
  const latest = useRef(input);
  const userId = getActiveUserId();
  const { libraryItemId, payloadStatus, remotePersistenceEnabled } = input;
  useEffect(() => {
    latest.current = input;
  });
  useEffect(() => {
    if (!remotePersistenceEnabled || payloadStatus !== READER_STATUS_READY)
      return;
    return trackReaderSession(libraryItemId, () => latest.current);
  }, [libraryItemId, payloadStatus, remotePersistenceEnabled, userId]);
}
