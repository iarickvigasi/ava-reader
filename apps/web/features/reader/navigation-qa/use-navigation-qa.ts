import { useEffect, useState } from "react";
import { READER_QA_ENABLED } from "../qa/build-config";
import { navigationQaEnabled } from "./qa-enabled";
import { createNavigationQa } from "./create-navigation-qa";
import { READER_QA_CHANNEL } from "./protocol";
export function useNavigationQa() {
  const [qa] = useState(() =>
    typeof window !== "undefined" &&
    navigationQaEnabled(
      window.location.hostname,
      process.env.NEXT_PUBLIC_AVA_READER_QA,
      READER_QA_ENABLED,
    )
      ? createNavigationQa()
      : null,
  );
  useEffect(() => {
    if (!qa) return;
    const channel = new BroadcastChannel(READER_QA_CHANNEL);
    const disconnect = qa.connect((ack) => channel.postMessage(ack));
    channel.onmessage = (event) => qa.receive(event.data);
    return () => {
      disconnect();
      channel.close();
    };
  }, [qa]);
  return qa;
}
