"use client";

import { useSyncExternalStore } from "react";
import { deviceTimeZone } from "./device-time-zone";
import { dayKey } from "./reading-days";

const snapshot = () => {
  const zone = deviceTimeZone();
  return `${zone}|${dayKey(new Date(), zone)}`;
};
const serverSnapshot = () => null;

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
  };
}

// The server does not know the device zone. Preserve hydration, then refresh on
// local date or zone changes, including resume after a suspended mobile timer.
export function useReadingCalendar() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
