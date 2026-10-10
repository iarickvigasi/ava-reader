import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { latestAccountScope } from "./latest-account-scope";
import { READER_BUILD_FINGERPRINT } from "@/features/reader/canonical/build";

export const actions = [
  "snapshot",
  "arm-fail",
  "arm-hold",
  "release",
  "cancel",
  "inject-stale",
] as const;
const subscribeHost = () => () => {};
const isLocalHost = () =>
  ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location.hostname);
export function useOperatorChannel() {
  const channel = useRef<BroadcastChannel | null>(null);
  const [receipts, setReceipts] = useState<unknown[]>([]);
  const local = useSyncExternalStore(subscribeHost, isLocalHost, () => false);
  const append = (receipt: unknown) =>
    setReceipts((rows) => [...rows.slice(-199), receipt]);
  useEffect(() => {
    if (!local) return;
    const current = new BroadcastChannel("ava-reader-qa");
    channel.current = current;
    current.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "ack") append(event.data);
    };
    return () => {
      channel.current = null;
      current.close();
    };
  }, [local]);
  function send(
    action: (typeof actions)[number],
    fields: Record<string, FormDataEntryValue>,
  ) {
    try {
      const scope = {
        libraryItemId: String(fields.libraryItemId),
        finalContentId: String(fields.finalContentId),
        readerFingerprint: READER_BUILD_FINGERPRINT,
      };
      const accountScope = latestAccountScope(receipts, scope);
      if (action !== "snapshot" && !accountScope) {
        append({
          error: "Get a successful snapshot of this reader session first.",
        });
        return;
      }
      const command = {
        type: "command",
        commandId: crypto.randomUUID(),
        action,
        scope: { ...scope, ...(accountScope ? { accountScope } : {}) },
        stage: fields.stage,
        ...(fields.target ? { target: JSON.parse(String(fields.target)) } : {}),
        ...(action === "inject-stale"
          ? {
              entryScope: fields.entryScope
                ? JSON.parse(String(fields.entryScope))
                : { ...scope, finalContentId: scope.finalContentId + "-stale" },
            }
          : {}),
      };
      append({ sent: command });
      channel.current?.postMessage(command);
    } catch {
      append({ error: "Invalid target or scope JSON" });
    }
  }
  return { local, receipts, send };
}
