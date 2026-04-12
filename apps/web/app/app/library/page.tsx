import { LibraryScreen } from "@/components/app/library/library-screen";
import type { LibraryPayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const library = await fetchServerApi<LibraryPayload>("/api/library", {
    returnBackUrl: "/app/library",
  });

  return <LibraryScreen library={library} />;
}
