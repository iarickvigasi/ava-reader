"use client";

import { useLayoutEffect } from "react";

export function useResetPageScroll(pathname: string) {
  useLayoutEffect(() => {
    // Browser history must not restore the previous document offset after our reset.
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.addEventListener("pageshow", resetPageScroll);
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener("pageshow", resetPageScroll);
    };
  }, []);

  // Run after the destination commits, before paint; bucket updates do not reset it.
  useLayoutEffect(resetPageScroll, [pathname]);
}

function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}
