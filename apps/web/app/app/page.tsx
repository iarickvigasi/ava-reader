import { HomeScreen } from "@/components/app/home/home-screen";
import { HomeScreenFromCache } from "@/components/app/home/home-screen-from-cache";
import { HomeHydrator } from "@/features/offline/buckets/home";
import type { HomePayload } from "@/lib/api-types";
import { fetchServerApi, isNetworkError } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  // Tolerate an unreachable API (offline). On a network failure we render the
  // client cache path, which reads the last-good payload from Dexie or shows
  // the offline-route fallback. Genuine errors still bubble.
  let home: HomePayload | null = null;
  try {
    home = await fetchServerApi<HomePayload>("/api/home", {
      returnBackUrl: "/app",
    });
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }
  }

  return (
    <>
      <HomeHydrator initial={home} />
      {home ? <HomeScreen home={home} /> : <HomeScreenFromCache />}
    </>
  );
}
