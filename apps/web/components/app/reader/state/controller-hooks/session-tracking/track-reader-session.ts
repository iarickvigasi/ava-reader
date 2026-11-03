import { isOnline } from "@/features/offline/net/net-state";
import {
  createReadingTracker,
  SESSION_CHECKPOINT_MS,
  syncPendingSessions,
  watchSessionLease,
} from "@/features/offline/buckets/sessions";
import type { ReaderControllerAuth } from "../../../shared/types";

export function trackReaderSession(
  libraryItemId: string,
  getAuth: () => ReaderControllerAuth,
): () => void {
  const tracker = createReadingTracker(libraryItemId);
  const flush = () => {
    const auth = getAuth();
    if (isOnline() && auth.isLoaded && auth.isSignedIn)
      void syncPendingSessions(auth.getToken);
  };
  const update = () => {
    const save =
      document.visibilityState === "visible"
        ? tracker.checkpoint()
        : tracker.stop();
    void save.then(flush);
  };
  const stop = () => {
    void tracker.stop().then(flush);
  };
  const unsubscribe = subscribeToReaderLifecycle(update, stop);
  update();
  return () => {
    unsubscribe();
    stop();
  };
}

function subscribeToReaderLifecycle(update: () => void, stop: () => void) {
  document.addEventListener("visibilitychange", update);
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", update);
  const timer = window.setInterval(update, SESSION_CHECKPOINT_MS);
  const unwatch = watchSessionLease(() => {
    if (document.visibilityState === "visible") update();
  });
  return () => {
    window.clearInterval(timer);
    unwatch();
    document.removeEventListener("visibilitychange", update);
    window.removeEventListener("pagehide", stop);
    window.removeEventListener("pageshow", update);
  };
}
