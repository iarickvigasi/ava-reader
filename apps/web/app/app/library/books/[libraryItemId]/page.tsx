import { notFound } from "next/navigation";
import { LibraryBookInfoScreen } from "@/components/app/library/book-info/book-info-screen";
import { APP_LIBRARY_HREF } from "@/lib/app-routes";
import type { LibraryBookInfoPayload } from "@/lib/api-types";
import { fetchServerApi, ServerApiError } from "@/lib/server-api";

export const dynamic = "force-dynamic";

async function getLibraryBookInfo(libraryItemId: string) {
  try {
    return await fetchServerApi<LibraryBookInfoPayload>(
      `/api/library/${libraryItemId}`,
      {
        returnBackUrl: `/app/library/books/${libraryItemId}`,
      },
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

function normalizeFromCollection(
  value: string | string[] | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export default async function LibraryBookInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ libraryItemId: string }>;
  searchParams: Promise<{ fromCollection?: string | string[] }>;
}) {
  const [{ libraryItemId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const payload = await getLibraryBookInfo(libraryItemId);
  const fromCollectionId = normalizeFromCollection(
    resolvedSearchParams.fromCollection,
  );
  const backHref = fromCollectionId
    ? `/app/library/collections/${encodeURIComponent(fromCollectionId)}`
    : APP_LIBRARY_HREF;

  return (
    <LibraryBookInfoScreen
      backHref={backHref}
      book={payload.book}
    />
  );
}
