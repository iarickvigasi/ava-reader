import { notFound } from "next/navigation";
import { AdminCatalogManager } from "@/components/app/admin/admin-catalog-manager";
import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import type { AdminCatalogEntry } from "@/lib/api-types";
import { ServerApiError, fetchServerApiTolerant } from "@/lib/server-api";

export const dynamic = "force-dynamic";

// Returns the entries, or null when the API is unreachable (offline) — admin
// data isn't cached offline, so we surface the offline-route fallback rather
// than crashing the route. The 403 (not-an-admin) case stays explicit because
// it has its own UX (notFound), not the offline fallback.
async function getAdminCatalogEntries(): Promise<AdminCatalogEntry[] | null> {
  try {
    return await fetchServerApiTolerant<AdminCatalogEntry[]>(
      "/api/admin/catalog",
      { returnBackUrl: "/app/admin/catalog" },
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 403) {
      notFound();
    }
    throw error;
  }
}

export default async function AdminCatalogPage() {
  const entries = await getAdminCatalogEntries();

  if (!entries) {
    return <OfflineRouteFallback routeKey="admin" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
          Internal admin
        </p>
        <h1 className="font-display text-5xl tracking-[-0.04em] text-ink">
          Public catalog manager
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-copy">
          Manage the real public-domain dataset that feeds the home screen. New
          titles stay draft by default and can be featured once they are ready
          for readers.
        </p>
      </div>

      <AdminCatalogManager initialEntries={entries} />
    </div>
  );
}
