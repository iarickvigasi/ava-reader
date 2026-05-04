import { ReaderScreen } from "@/components/app/reader/reader-screen";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const reader = await fetchServerApi<ReaderStatusPayload>(
    `/api/library/${slug}/reader`,
    {
      returnBackUrl: `/app/read/${slug}`,
    },
  );

  return (
    <ReaderScreen
      initialPayload={reader}
      libraryItemId={reader.book.libraryItemId}
    />
  );
}
