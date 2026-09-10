import { describe, expect, it } from "vitest";
import {
  collectionFieldErrors,
  normalizeCollectionText,
} from "./collection-input";

describe("collection form validation", () => {
  it("trims field edges and capitalizes the first letter without changing other text", () => {
    expect(normalizeCollectionText("  📚 українські книги  ")).toBe(
      "📚 Українські книги",
    );
    expect(normalizeCollectionText("  my TBR list\nnext line  ")).toBe(
      "My TBR list\nnext line",
    );
    expect(normalizeCollectionText("   ")).toBe("");
  });
  it("requires a title and enforces normalized field lengths", () => {
    expect(collectionFieldErrors("   ", "").name).toBe("nameEmpty");
    expect(collectionFieldErrors("x".repeat(101), "").name).toBe("nameTooLong");
    expect(collectionFieldErrors("Reads", "x".repeat(1001)).description).toBe(
      "descriptionTooLong",
    );
    expect(collectionFieldErrors(" " + "x".repeat(100) + " ", " ")).toEqual({
      name: null,
      description: null,
    });
  });
});
