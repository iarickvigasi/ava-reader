"use client";

import { createContext, useContext } from "react";

// The reconciled owner of mounted local views, not network authentication.
export const DeviceOwnerContext = createContext<string | null>(null);
export function useMountedDeviceOwner() {
  return useContext(DeviceOwnerContext);
}
