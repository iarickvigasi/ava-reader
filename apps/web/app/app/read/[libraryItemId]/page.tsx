import { redirect } from "next/navigation";
import { ReaderScreen } from "@/components/app/reader-screen";
import type { HomePayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ libraryItemId: string }>;
}) {
  const home = await fetchServerApi<HomePayload>("/api/home", {
    returnBackUrl: "/app",
  });
  const { libraryItemId } = await params;

  if (!home.currentEngagement) {
    redirect("/app");
  }

  if (home.currentEngagement.id !== libraryItemId) {
    redirect(`/app/read/${home.currentEngagement.id}`);
  }

  return <ReaderScreen currentEngagement={home.currentEngagement} />;
}
