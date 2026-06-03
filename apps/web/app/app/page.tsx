import { HomeScreen } from "@/components/app/home/home-screen";
import { HomeScreenFromCache } from "@/components/app/home/home-screen-from-cache";
import { HomeHydrator } from "@/features/offline/buckets/home";
import type { HomePayload } from "@/lib/api-types";
import { fetchServerApiTolerant } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  // Tolerate an unreachable API (offline). A null return renders the client
  // cache path, which reads the last-good payload from Dexie or shows the
  // offline-route fallback. Real HTTP errors still bubble.
  const home = await fetchServerApiTolerant<HomePayload>("/api/home", {
    returnBackUrl: "/app",
  });

  return (
    <>
      <HomeHydrator initial={home} />
      {home ? <HomeScreen home={home} /> : <HomeScreenFromCache />}
    </>
  );
}
