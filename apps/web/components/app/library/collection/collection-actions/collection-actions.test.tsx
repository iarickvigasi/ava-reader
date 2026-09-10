import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EditCollectionModal } from "./edit-modal";
import { LibraryCollectionActions } from "./collection-actions";
import { withIntl } from "@/lib/test-utils/intl";

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
  it("renders edit and delete buttons for custom collections", () => {
    const markup = renderToStaticMarkup(
      withIntl(
        <LibraryCollectionActions
          collectionDescription="Your personal uploads."
          collectionId="collection-1"
          collectionKind="CUSTOM"
          collectionName="Imported Books"
        />,
      ),
    );

    expect(markup).toContain("Edit");
    expect(markup).toContain("Delete");
  });

  it("renders no actions for smart collections", () => {
    const markup = renderToStaticMarkup(
      withIntl(
        <LibraryCollectionActions
          collectionDescription="Auto-generated collection."
          collectionId="smart-collection-1"
          collectionKind="SMART"
          collectionName="Imported Books"
        />,
      ),
    );

    expect(markup).not.toContain("Edit");
    expect(markup).not.toContain("Delete");
  });

  it("renders edit modal controls in editing mode", () => {
    const markup = renderToStaticMarkup(
      withIntl(
        <LibraryCollectionActions
          collectionDescription="Your personal uploads."
          collectionId="collection-1"
          collectionKind="CUSTOM"
          collectionName="Imported Books"
          initialModalMode="edit"
        />,
      ),
    );

    expect(markup).toContain("Edit details");
    expect(markup).toContain('aria-label="Collection title"');
    expect(markup).toContain('aria-label="Collection description"');
    expect(markup).toContain("Save");
    expect(markup).toContain("Cancel");
  });

  it("renders delete confirmation modal controls", () => {
    const markup = renderToStaticMarkup(
      withIntl(
        <LibraryCollectionActions
          collectionDescription="Your personal uploads."
          collectionId="collection-1"
          collectionKind="CUSTOM"
          collectionName="Imported Books"
          initialModalMode="delete"
        />,
      ),
    );

    expect(markup).toContain("Delete collection?");
    expect(markup).toContain("Confirm delete");
    expect(markup).toContain("Cancel");
  });
});


describe("create collection form", () => {
  function renderForm(overrides: Partial<React.ComponentProps<typeof EditCollectionModal>> = {}) {
    return renderToStaticMarkup(withIntl(<EditCollectionModal
      mode="create" collectionName="Reading list" collectionDescription=""
      error={null} isPending={false} onClose={() => {}} onNameChange={() => {}}
      onDescriptionChange={() => {}} onSubmit={() => {}} {...overrides}
    />));
  }

  it("reuses localized fields with creation actions and optional description", () => {
    const markup = renderForm();
    expect(markup).toContain("Create collection");
    expect(markup).toContain("(optional)");
    expect(markup).toContain('aria-label="Collection title"');
    expect(markup).toContain('aria-label="Collection description"');
    expect(markup).not.toContain("Edit details");
  });

  it("preserves the draft and explains why creation is disabled offline", () => {
    const markup = renderForm({ offline: true });
    expect(markup).toContain('value="Reading list"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Connect to the internet");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*type="submit"/);
  });

  it("shows a field error for overlong descriptions and a pending label while saving", () => {
    expect(renderForm({ collectionDescription: "x".repeat(1001) })).toContain("Description must be 1,000 characters or fewer.");
    expect(renderForm({ isPending: true })).toContain("Creating…");
  });
});
