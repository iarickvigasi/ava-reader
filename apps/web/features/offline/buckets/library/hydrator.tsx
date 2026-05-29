"use client";

// Render-less client components that drive bucket hydration + revalidation
// for the library, collection, and book-info screens. They live separately
// from the screen components themselves so the visual layer can be tested
// without a ClerkProvider in scope (the auth hook lives here).

import type {
  LibraryBookInfo,
  LibraryCollection,
  LibraryPayload,
} from "@/lib/api-types/library";

import {
  useHydrateBookInfo,
  useHydrateCollection,
  useHydrateLibrary,
} from "./hooks";

export function LibraryHydrator({ initial }: { initial: LibraryPayload }) {
  useHydrateLibrary(initial);
  return null;
}

export function CollectionHydrator({
  initial,
}: {
  initial: LibraryCollection;
}) {
  useHydrateCollection(initial);
  return null;
}

export function BookInfoHydrator({
  initial,
}: {
  initial: LibraryBookInfo;
}) {
  useHydrateBookInfo(initial);
  return null;
}
