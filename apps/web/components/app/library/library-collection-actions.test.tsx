import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryCollectionActions } from "./library-collection-actions";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn(),
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("library collection actions", () => {
  it("renders edit and delete buttons by default", () => {
    const markup = renderToStaticMarkup(
      <LibraryCollectionActions
        collectionDescription="Your personal uploads."
        collectionId="collection-1"
        collectionName="Imported Books"
      />,
    );

    expect(markup).toContain("Edit");
    expect(markup).toContain("Delete");
  });

  it("renders edit modal controls in editing mode", () => {
    const markup = renderToStaticMarkup(
      <LibraryCollectionActions
        collectionDescription="Your personal uploads."
        collectionId="collection-1"
        collectionName="Imported Books"
        initialModalMode="edit"
      />,
    );

    expect(markup).toContain("Edit details");
    expect(markup).toContain('aria-label="Collection title"');
    expect(markup).toContain('aria-label="Collection description"');
    expect(markup).toContain("Save");
    expect(markup).toContain("Cancel");
  });

  it("renders delete confirmation modal controls", () => {
    const markup = renderToStaticMarkup(
      <LibraryCollectionActions
        collectionDescription="Your personal uploads."
        collectionId="collection-1"
        collectionName="Imported Books"
        initialModalMode="delete"
      />,
    );

    expect(markup).toContain("Delete collection?");
    expect(markup).toContain("Confirm delete");
    expect(markup).toContain("Cancel");
  });
});
