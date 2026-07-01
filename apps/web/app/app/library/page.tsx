import { LibraryScreen } from "@/components/app/library/library-screen";
import { LibraryScreenFromCache } from "@/components/app/library/library-screen-from-cache";
import { LibraryHydrator } from "@/features/offline/buckets/library";
import type { LibraryPayload } from "@/lib/api-types";
import { fetchServerApiTolerant } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  // Tolerate an unreachable API or an unverifiable (stale, Clerk-offline)
  // session. A null return renders the client cache path, which reads the
  // last-good library view from Dexie. Real HTTP errors still bubble.
  const library = await fetchServerApiTolerant<LibraryPayload>("/api/library", {
    returnBackUrl: "/app/library",
  });

  return library ? (
    <>
      {/* LibraryHydrator is a render-less client island that seeds the
          offline-first Dexie bucket from this RSC payload and revalidates
          against the API while online. The visual screen below stays
          decoupled from auth/hydration so it remains SSR-testable. */}
      <LibraryHydrator initial={library} />
      <LibraryScreen library={library} />
    </>
  ) : (
    <LibraryScreenFromCache />
  );
}
