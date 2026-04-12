"use client";

import type { FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { AdminCatalogEntry } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { getPublicApiBaseUrl } from "@/lib/api";

type AdminCatalogManagerProps = {
  initialEntries: AdminCatalogEntry[];
};

export function AdminCatalogManager({
  initialEntries,
}: AdminCatalogManagerProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submitForm(
    path: string,
    method: "POST" | "PATCH",
    formElement: HTMLFormElement,
  ) {
    const token = await getToken();

    if (!token) {
      setNotice("No Clerk session token was available.");
      return null;
    }

    const response = await fetch(`${getPublicApiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: new FormData(formElement),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setNotice(payload?.message ?? "The catalog request could not be completed.");
      return null;
    }

    const payload = (await response.json()) as AdminCatalogEntry;
    setNotice(method === "POST" ? "Catalog entry created." : "Catalog entry updated.");
    router.refresh();

    return payload;
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const payload = await submitForm("/api/admin/catalog", "POST", form);

    if (!payload) {
      return;
    }

    setEntries((current) => [payload, ...current.filter((entry) => entry.id !== payload.id)]);
    form.reset();
  }

  async function onUpdate(
    entryId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const payload = await submitForm(
      `/api/admin/catalog/${entryId}`,
      "PATCH",
      event.currentTarget,
    );

    if (!payload) {
      return;
    }

    setEntries((current) =>
      current.map((entry) => (entry.id === payload.id ? payload : entry)),
    );
  }

  return (
    <div className="space-y-10">
      <section className="rounded-[28px] bg-surface px-6 py-6 sm:px-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
              Create catalog entry
            </p>
            <h2 className="font-display text-4xl text-ink">
              Add a public-domain book
            </h2>
          </div>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) =>
            startTransition(() => {
              void onCreate(event);
            })
          }>
            <Field label="Title" name="title" required />
            <Field label="Author" name="author" />
            <TextAreaField
              className="sm:col-span-2"
              label="Description"
              name="description"
            />
            <TextAreaField
              className="sm:col-span-2"
              label="Editorial Description"
              name="editorialDescription"
            />
            <TextAreaField
              className="sm:col-span-2"
              label="Curator Note"
              name="curatorNote"
            />
            <Field label="Sort Order" name="sortOrder" type="number" />
            <Field label="Featured Rank" name="featuredRank" type="number" />
            <SelectField label="Status" name="status">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </SelectField>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-3 text-sm text-copy">
                <input type="checkbox" name="isFeatured" value="true" />
                Feature on home
              </label>
            </div>
            <FileField
              accept=".epub,.pdf,application/epub+zip,application/pdf"
              label="Source file"
              name="sourceFile"
              required
            />
            <FileField accept="image/*" label="Cover image" name="coverImage" />
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-[14px] border border-brand-fill bg-brand-fill px-6 text-xs font-bold uppercase tracking-[0.16em] text-brand-foreground shadow-[var(--shadow-card)] transition hover:bg-brand-fill-strong disabled:opacity-60"
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Create Entry"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
              Existing catalog
            </p>
            <h2 className="font-display text-4xl text-ink">Curated titles</h2>
          </div>
          <p className="text-sm text-muted">{entries.length} entries</p>
        </div>

        {notice ? <p className="text-sm text-muted">{notice}</p> : null}

        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="rounded-[24px] bg-white/45 px-6 py-6 text-copy">
              The catalog is empty. Create the first title above.
            </div>
          ) : (
            entries.map((entry) => (
              <details
                key={entry.id}
                className="rounded-[24px] bg-white/45 px-6 py-5"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <CoverPreview title={entry.book.title} src={entry.book.coverImageDataUrl} />
                      <div className="space-y-1">
                        <p className="font-display text-2xl text-title">
                          {entry.book.title}
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-plum">
                          {entry.book.author ?? "Unknown author"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                      <Badge>{entry.status}</Badge>
                      {entry.isFeatured ? <Badge>Featured</Badge> : null}
                      <Badge>{entry.book.primaryFormat}</Badge>
                    </div>
                  </div>
                </summary>

                <form
                  className="mt-6 grid gap-4 border-t border-line/50 pt-6 sm:grid-cols-2"
                  onSubmit={(event) =>
                    startTransition(() => {
                      void onUpdate(entry.id, event);
                    })
                  }
                >
                  <Field
                    defaultValue={entry.book.title}
                    label="Title"
                    name="title"
                    required
                  />
                  <Field
                    defaultValue={entry.book.author ?? ""}
                    label="Author"
                    name="author"
                  />
                  <TextAreaField
                    className="sm:col-span-2"
                    defaultValue={entry.book.description ?? ""}
                    label="Description"
                    name="description"
                  />
                  <TextAreaField
                    className="sm:col-span-2"
                    defaultValue={entry.editorialDescription ?? ""}
                    label="Editorial Description"
                    name="editorialDescription"
                  />
                  <TextAreaField
                    className="sm:col-span-2"
                    defaultValue={entry.curatorNote ?? ""}
                    label="Curator Note"
                    name="curatorNote"
                  />
                  <Field
                    defaultValue={String(entry.sortOrder)}
                    label="Sort Order"
                    name="sortOrder"
                    type="number"
                  />
                  <Field
                    defaultValue={entry.featuredRank?.toString() ?? ""}
                    label="Featured Rank"
                    name="featuredRank"
                    type="number"
                  />
                  <SelectField
                    defaultValue={entry.status}
                    label="Status"
                    name="status"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </SelectField>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-3 text-sm text-copy">
                      <input
                        type="checkbox"
                        name="isFeatured"
                        value="true"
                        defaultChecked={entry.isFeatured}
                      />
                      Feature on home
                    </label>
                  </div>
                  <FileField
                    accept=".epub,.pdf,application/epub+zip,application/pdf"
                    label="Replace source"
                    name="sourceFile"
                  />
                  <FileField accept="image/*" label="Replace cover" name="coverImage" />
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-line bg-white/70 px-5 text-xs font-bold uppercase tracking-[0.16em] text-ink transition hover:bg-white"
                      disabled={isPending}
                    >
                      {isPending ? "Saving..." : "Update Entry"}
                    </button>
                  </div>
                </form>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  className,
  defaultValue,
  label,
  name,
  required,
  type = "text",
}: {
  className?: string;
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <input
        className="min-h-12 rounded-[14px] border border-line bg-white/70 px-4 text-base text-copy-strong outline-none transition focus:border-line-strong"
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function TextAreaField({
  className,
  defaultValue,
  label,
  name,
}: {
  className?: string;
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <textarea
        className="min-h-28 rounded-[14px] border border-line bg-white/70 px-4 py-3 text-base text-copy-strong outline-none transition focus:border-line-strong"
        defaultValue={defaultValue}
        name={name}
      />
    </label>
  );
}

function SelectField({
  children,
  defaultValue,
  label,
  name,
}: {
  children: ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <select
        className="min-h-12 rounded-[14px] border border-line bg-white/70 px-4 text-base text-copy-strong outline-none transition focus:border-line-strong"
        defaultValue={defaultValue}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

function FileField({
  accept,
  label,
  name,
  required = false,
}: {
  accept: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <input
        className="min-h-12 rounded-[14px] border border-dashed border-line bg-white/55 px-4 py-3 text-sm text-copy"
        accept={accept}
        name={name}
        required={required}
        type="file"
      />
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line/60 bg-white/70 px-3 py-1">
      {children}
    </span>
  );
}

function CoverPreview({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  if (src) {
    return (
      <div className="size-16 overflow-hidden rounded-[10px] border border-line/40 bg-white/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`${title} cover`} className="size-full object-cover" src={src} />
      </div>
    );
  }

  return (
    <div className="flex size-16 items-end rounded-[10px] border border-line/40 bg-[linear-gradient(180deg,#efe1d5_0%,#d9cabc_100%)] p-2">
      <p className="line-clamp-3 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-olive">
        {title}
      </p>
    </div>
  );
}
