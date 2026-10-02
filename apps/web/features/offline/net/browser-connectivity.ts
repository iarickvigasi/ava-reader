// Presentation follows browser connectivity; net-state separately gates API sync.
export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function subscribeToBrowserConnectivity(
  listener: (online: boolean) => void,
): () => void {
  const notify = () => listener(isBrowserOnline());
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}
