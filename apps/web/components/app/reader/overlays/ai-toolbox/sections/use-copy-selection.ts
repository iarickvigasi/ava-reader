import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { emitAppToast } from "@/components/app/core/app-toast";
import { useReaderSelectionContext } from "../../../selection/reader-selection-context";
import { copyTextToClipboard } from "@/lib/copy-text-to-clipboard";

// How long the button shows the "copied" check before reverting.
const COPIED_RESET_MS = 2000;

// Copy-selection behaviour for the toolbox selection strip (spec 5.2,
// Behaviour 6): writes the exact selection text to the clipboard, exposes a
// transient `isCopied` flag for the inline check confirmation, and toasts on
// failure — success stays toast-free.
export function useCopySelection(): {
  isCopied: boolean;
  copySelection: () => void;
} {
  const t = useTranslations("reader.aiToolbox");
  const { text } = useReaderSelectionContext();
  const [isCopied, setIsCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop a pending revert when the panel unmounts mid-confirmation.
  useEffect(
    () => () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const copySelection = async () => {
    if (!text) {
      return;
    }
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      emitAppToast({ message: t("selectionCopyFailed"), tone: "error" });
      return;
    }
    setIsCopied(true);
    // Re-copying restarts the confirmation window rather than stacking timers.
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
  };

  return { isCopied, copySelection };
}
