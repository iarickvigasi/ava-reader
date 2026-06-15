import { BookInfoLoader } from "@/components/app/library/book-info/book-info-loader";

// Generic shell (ADR 4): no server data fetch and no params/searchParams read,
// so the document is identical for every slug — the SW keeps one cached shell
// per family and the client loader hydrates the right book from
// location.pathname + Dexie. The card-hint search params are still consumed
// client-side by the loading skeleton and the back link.
export const dynamic = "force-dynamic";

export default function LibraryBookInfoPage() {
  return <BookInfoLoader />;
}
