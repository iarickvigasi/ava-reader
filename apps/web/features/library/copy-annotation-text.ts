import { emitAppToast } from "@/components/app/core/app-toast";
import { copyTextToClipboard } from "@/lib/copy-text-to-clipboard";
import type { AnnotationCopyMessages } from "./types";

export async function copyAnnotationText(text: string, messages: AnnotationCopyMessages): Promise<void> {
  const copied = await copyTextToClipboard(text);
  emitAppToast({
    message: copied ? messages.success : messages.failure,
    tone: copied ? "info" : "error",
  });
}
