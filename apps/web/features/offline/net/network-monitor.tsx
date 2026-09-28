"use client";

import { useEffect } from "react";
import { startNetworkMonitor } from "./start-network-monitor";

export function NetworkMonitor() {
  useEffect(startNetworkMonitor, []);
  return null;
}
