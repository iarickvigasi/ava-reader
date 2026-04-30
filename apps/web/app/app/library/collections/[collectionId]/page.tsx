import { notFound } from "next/navigation";
import { LibraryCollectionScreen } from "@/components/app/library/collection-screen";
import type { LibraryCollectionPayload } from "@/lib/api-types";
import { ServerApiError, fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

async function getLibraryCollection(collectionId: string) {
  try {
    return await fetchServerApi<LibraryCollectionPayload>(
      `/api/library/collections/${collectionId}`,
      {
        returnBackUrl: `/app/library/collections/${collectionId}`,
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
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const payload = await getLibraryCollection(collectionId);

  return <LibraryCollectionScreen collection={payload.collection} />;
}
