import { LibraryScreen } from "@/components/app/library/library-screen";
import { LibraryHydrator } from "@/features/offline/buckets/library";
import type { LibraryPayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const library = await fetchServerApi<LibraryPayload>("/api/library", {
    returnBackUrl: "/app/library",
  });

  return (
    <>
      {/* LibraryHydrator is a render-less client island that seeds the
          offline-first Dexie bucket from this RSC payload and revalidates
          against the API while online. The visual screen below stays
          decoupled from auth/hydration so it remains SSR-testable. */}
      <LibraryHydrator initial={library} />
      <LibraryScreen library={library} />
    </>
  );
}
