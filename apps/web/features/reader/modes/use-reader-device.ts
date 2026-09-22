"use client";

import { useSyncExternalStore } from "react";

const PHONE_SHORT_SIDE = 600;
type ReaderDevice = "desktop" | "phone-portrait" | "phone-landscape";

export function resolveReaderDevice(input: {
  coarse: boolean;
  width: number;
  height: number;
  orientation?: string;
  angle?: number;
}): ReaderDevice {
  if (
    !input.coarse ||
    Math.min(input.width, input.height) >= PHONE_SHORT_SIDE
  ) {
    return "desktop";
  }
  const landscape = input.orientation
    ? input.orientation.startsWith("landscape")
    : typeof input.angle === "number"
      ? Math.abs(input.angle) % 180 === 90
      : input.width > input.height;
  return landscape ? "phone-landscape" : "phone-portrait";
}

function snapshot(): ReaderDevice {
  const legacyOrientation: unknown = window.orientation;
  return resolveReaderDevice({
    coarse: window.matchMedia("(pointer: coarse)").matches,
    width: window.screen.width,
    height: window.screen.height,
    orientation: window.screen.orientation?.type,
    angle:
      typeof legacyOrientation === "number" ? legacyOrientation : undefined,
  });
}

function subscribe(notify: () => void) {
  const coarse = window.matchMedia("(pointer: coarse)");
  coarse.addEventListener("change", notify);
  window.screen.orientation?.addEventListener("change", notify);
  window.addEventListener("orientationchange", notify);
  window.addEventListener("resize", notify);
  return () => {
    coarse.removeEventListener("change", notify);
    window.screen.orientation?.removeEventListener("change", notify);
    window.removeEventListener("orientationchange", notify);
    window.removeEventListener("resize", notify);
  };
}

export function useReaderDevice() {
  return useSyncExternalStore(subscribe, snapshot, () => "desktop" as const);
}
