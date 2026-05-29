import { notFound } from "next/navigation";
import { LibraryBookInfoScreen } from "@/components/app/library/book-info/book-info-screen";
import { BookInfoHydrator } from "@/features/offline/buckets/library";
import {
  APP_LIBRARY_HREF,
  getCollectionHref,
  parseLibraryCardFromSearch,
} from "@/lib/app-routes";
import type {
  LibraryBookInfo,
  LibraryBookInfoDetailsPayload,
  LibraryBookInfoPayload,
} from "@/lib/api-types";
import { fetchServerApi, ServerApiError } from "@/lib/server-api";

export const dynamic = "force-dynamic";

async function getLibraryBookInfo(slug: string) {
  try {
    return await fetchServerApi<LibraryBookInfoPayload>(
      `/api/library/${slug}`,
      { returnBackUrl: `/app/library/books/${slug}` },
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

async function getLibraryBookInfoDetails(slug: string) {
  try {
    return await fetchServerApi<LibraryBookInfoDetailsPayload>(
      `/api/library/${slug}/details`,
      { returnBackUrl: `/app/library/books/${slug}` },
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

export default async function LibraryBookInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const card = parseLibraryCardFromSearch(search, slug);

  // Path A: card hints are complete — fetch only the detail delta and stitch
  // it together with what the URL already carries. Avoids re-sending fields
  // the navigating list already gave us.
  //
  // Path B: direct nav, refresh, or stale link — no card hints — fall back to
  // the full payload from /api/library/:slug.
  const book: LibraryBookInfo = card
    ? { ...card, ...(await getLibraryBookInfoDetails(slug)).details }
    : (await getLibraryBookInfo(slug)).book;

  const fromCollectionSlug = pickFromCollection(search.fromCollection);
  const backHref = fromCollectionSlug
    ? getCollectionHref(fromCollectionSlug)
    : APP_LIBRARY_HREF;

  return (
    <>
      {/* Seeds Dexie with the full LibraryBookInfo on first visit so the
          page works offline thereafter. Revalidates against the API while
          online so cached details (description, language, page count, …)
          stay fresh. */}
      <BookInfoHydrator initial={book} />
      <LibraryBookInfoScreen backHref={backHref} book={book} />
    </>
  );
}

function pickFromCollection(
  value: string | string[] | undefined,
): string | null {
  if (!value) {
    return null;
  }
  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}
