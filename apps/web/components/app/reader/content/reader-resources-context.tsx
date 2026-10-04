import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import {
  createResourceRecovery,
  type ReaderResourceRecovery,
} from "@/features/reader/canonical/resource-recovery";
import { resourceOwnerIsCurrent } from "@/features/reader/canonical/resource-owner";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { resolveReaderAuthToken } from "../data/reader-auth";

const ReaderResourcesContext = createContext<{
  recovery: ReaderResourceRecovery;
  snapshot: ReturnType<ReaderResourceRecovery["getSnapshot"]>;
} | null>(null);

export function ReaderResourcesProvider({
  payload,
  children,
}: {
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  children: ReactNode;
}) {
  const auth = useOfflineAuth();
  const [recovery] = useState(() =>
    createResourceRecovery(payload, {
      apiBase: getPublicApiBaseUrl(),
      getToken: () => resolveReaderAuthToken(auth),
      isCurrent: () => resourceOwnerIsCurrent(auth.userId),
    }),
  );
  useLayoutEffect(() => {
    recovery.setAccess({
      apiBase: getPublicApiBaseUrl(),
      getToken: () => resolveReaderAuthToken(auth),
      isCurrent: () => resourceOwnerIsCurrent(auth.userId),
    });
  }, [auth, recovery]);
  const snapshot = useSyncExternalStore(
    recovery.subscribe,
    recovery.getSnapshot,
    recovery.getSnapshot,
  );
  useLayoutEffect(() => {
    recovery.activate();
    return () => recovery.deactivate();
  }, [recovery]);
  return (
    <ReaderResourcesContext value={{ recovery, snapshot }}>
      {children}
    </ReaderResourcesContext>
  );
}

export function useReaderResources() {
  return useContext(ReaderResourcesContext);
}
