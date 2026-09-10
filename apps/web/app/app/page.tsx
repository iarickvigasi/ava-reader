import { HomeScreen } from "@/components/app/home/home-screen";
import { HomeScreenFromCache } from "@/components/app/home/home-screen-from-cache";
import { HomeHydrator } from "@/features/offline/buckets/home";
import type { HomePayload } from "@/lib/api-types";
import { fetchServerApiResult } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const result = await fetchServerApiResult<HomePayload>("/api/home", {
    returnBackUrl: "/app",
  });

  const home = result.status === "ready" ? result.data : null;

  return (
    <>
      <HomeHydrator initial={home} />
      {home ? <HomeScreen home={home} /> : <HomeScreenFromCache reason={result.status === "ready" ? "unavailable" : result.status} />}
    </>
  );
}
