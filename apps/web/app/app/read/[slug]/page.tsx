import { ReaderScreenLoader } from "@/components/app/reader/reader-screen-loader";

// Generic shell (ADR 4): no server data fetch and no params read, so the
// document is identical for every slug — the SW keeps one cached shell per
// family and the client loader hydrates the right book from
// location.pathname + Dexie.
export const dynamic = "force-dynamic";

export default function ReaderPage() {
  return <ReaderScreenLoader />;
}
