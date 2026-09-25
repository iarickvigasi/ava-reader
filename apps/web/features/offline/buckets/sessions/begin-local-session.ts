import { deviceTimeZone } from "../../stats/device-time-zone";
import { generateClientSessionId } from "./id";
import { createLocalSession } from "./storage";

export function beginLocalSession(libraryItemId: string) {
  const session = {
    clientSessionId: generateClientSessionId(),
    startedAt: new Date().toISOString(),
    timeZone: deviceTimeZone(),
  };
  void createLocalSession({ ...session, libraryItemId });
  return session;
}
