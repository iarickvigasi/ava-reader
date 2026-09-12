// Thin Clipboard API wrapper: resolves true when `text` reached the system
// clipboard, false when the API is missing (insecure context, old browser)
// or the write was rejected (permission denied, document not focused).
// Callers surface the failure; nothing here throws.
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
