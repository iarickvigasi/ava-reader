import { ReaderScreen } from "@/components/app/reader-screen";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ libraryItemId: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { libraryItemId } = await params;
  const { chapter } = await searchParams;
  const reader = await fetchServerApi<ReaderStatusPayload>(
    `/api/library/${libraryItemId}/reader${chapter ? `?chapter=${encodeURIComponent(chapter)}` : ""}`,
    {
      returnBackUrl: `/app/read/${libraryItemId}`,
    },
  );

  return (
    <ReaderScreen
      initialChapterParam={chapter ?? null}
      initialPayload={reader}
      libraryItemId={libraryItemId}
    />
  );
}
