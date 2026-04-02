import { HomeScreen } from "@/components/app/home-screen";
import type { HomePayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const home = await fetchServerApi<HomePayload>("/api/home", {
    returnBackUrl: "/app",
  });

  return <HomeScreen home={home} />;
}
