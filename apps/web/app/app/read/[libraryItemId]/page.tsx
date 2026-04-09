import { ReaderScreen } from "@/components/app/reader-screen";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ libraryItemId: string }>;
}) {
  const { libraryItemId } = await params;
  const reader = await fetchServerApi<ReaderStatusPayload>(
    `/api/library/${libraryItemId}/reader`,
    {
      returnBackUrl: `/app/read/${libraryItemId}`,
    },
  );

  return (
    <ReaderScreen
      initialPayload={reader}
      libraryItemId={libraryItemId}
    />
  );
}
