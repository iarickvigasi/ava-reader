import { getPublicApiBaseUrl } from "@/lib/api";
import { withDeadline } from "@/features/auth/with-deadline";
import type { MasteryHistoryPage } from "./types";

export async function fetchMasteryHistory(
  before: string,
  getToken: () => Promise<string | null>,
  controller: AbortController,
): Promise<MasteryHistoryPage> {
  async function request() {
    if (!navigator.onLine) throw new Error("offline");
    const token = await getToken();
    controller.signal.throwIfAborted();
    if (!token) throw new Error("authentication unavailable");
    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/home/mastery?before=${before}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("history request failed");
    return response.json() as Promise<MasteryHistoryPage>;
  }
  try {
    return await withDeadline(request());
  } finally {
    controller.abort();
  }
}
