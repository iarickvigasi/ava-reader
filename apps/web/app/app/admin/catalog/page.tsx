import { notFound } from "next/navigation";
import { AdminCatalogManager } from "@/components/app/admin/admin-catalog-manager";
import type { AdminCatalogEntry } from "@/lib/api-types";
import { ServerApiError, fetchServerApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

async function getAdminCatalogEntries() {
  try {
    return await fetchServerApi<AdminCatalogEntry[]>("/api/admin/catalog", {
      returnBackUrl: "/app/admin/catalog",
    });
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 403) {
      notFound();
    }

    throw error;
  }
}

export default async function AdminCatalogPage() {
  const entries = await getAdminCatalogEntries();

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
