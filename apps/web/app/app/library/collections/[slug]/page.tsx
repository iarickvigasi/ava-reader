import { notFound } from "next/navigation";
import { LibraryCollectionScreen } from "@/components/app/library/collection/collection-screen";
import { CollectionHydrator } from "@/features/offline/buckets/library";
import type { LibraryCollectionPayload } from "@/lib/api-types";
import { ServerApiError, fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

async function getLibraryCollection(slug: string) {
  try {
    return await fetchServerApi<LibraryCollectionPayload>(
      `/api/library/collections/${slug}`,
      {
        returnBackUrl: `/app/library/collections/${slug}`,
      },
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export default async function LibraryCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const payload = await getLibraryCollection(slug);

  return (
    <>
      {/* CollectionHydrator seeds Dexie from this RSC payload and
          revalidates against the API while online. The screen itself stays
          render-only so it remains SSR-testable without a ClerkProvider. */}
      <CollectionHydrator initial={payload.collection} />
      <LibraryCollectionScreen collection={payload.collection} />
    </>
  );
}
