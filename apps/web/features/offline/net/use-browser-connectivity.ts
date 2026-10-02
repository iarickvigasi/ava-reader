import { useSyncExternalStore } from "react";
import {
  isBrowserOnline,
  subscribeToBrowserConnectivity,
} from "./browser-connectivity";

export function useBrowserConnectivity(): boolean {
  return useSyncExternalStore(
    subscribeToBrowserConnectivity,
    isBrowserOnline,
    () => true,
  );
}
