import { useEffect } from "react";
import { useNetworkState } from "../../../net/use-network-state";
import { persistCoverFromNetwork } from "../persist-cover-blob";

export function useCoverRefresh(
  id: string | null,
  src: string | null,
  cached: string | null | undefined,
) {
  const online = useNetworkState();
  useEffect(() => {
    if (id && src && online) void persistCoverFromNetwork(id, src);
  }, [id, src, cached, online]);
}
